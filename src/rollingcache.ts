import { existsSync, readdirSync, renameSync } from "fs";
import { emptyDirSync, ensureFileSync, readJsonSync, removeSync, writeJsonSync } from "fs-extra";
import * as _ from "lodash";

import { ICache } from "./icache";

/**
 * Saves data in new cache folder or reads it from old one.
 * Avoids perpetually growing cache and situations when things need to consider changed and then reverted data to be changed.
 */
export class RollingCache<DataType> implements ICache<DataType>
{
	private oldCacheRoot: string;
	private newCacheRoot: string;
	private rolled: boolean = false;

	/** @param cacheRoot: root folder for the cache */
	constructor(private cacheRoot: string)
	{
		this.oldCacheRoot = `${this.cacheRoot}/cache`;
		this.newCacheRoot = `${this.cacheRoot}/cache_`;
		emptyDirSync(this.newCacheRoot);
	}

	/** @returns true if name exists in either old cache or new cache */
	public exists(name: string): boolean
	{
		if (this.rolled)
			return false;

		if (existsSync(`${this.newCacheRoot}/${name}`))
			return true;

		return existsSync(`${this.oldCacheRoot}/${name}`);
	}

	public path(name: string): string
	{
		return `${this.oldCacheRoot}/${name}`;
	}

	/** @returns true if old cache contains all names and nothing more */
	public match(names: string[]): boolean
	{
		if (this.rolled)
			return false;

		if (!existsSync(this.oldCacheRoot))
			return names.length === 0; // empty folder matches

		return _.isEqual(readdirSync(this.oldCacheRoot).sort(), names.sort());
	}

	/** @returns data for name, must exist in either old cache or new cache */
	public read(name: string): DataType | null | undefined
	{
		if (existsSync(`${this.newCacheRoot}/${name}`))
			return readJsonSync(`${this.newCacheRoot}/${name}`, { encoding: "utf8", throws: false });

		return readJsonSync(`${this.oldCacheRoot}/${name}`, { encoding: "utf8", throws: false });
	}

	public write(name: string, data: DataType): void
	{
		if (this.rolled)
			return;

		if (data === undefined)
			return;

		writeJsonSync(`${this.newCacheRoot}/${name}`, data);
	}

	public touch(name: string)
	{
		if (this.rolled)
			return;

		ensureFileSync(`${this.newCacheRoot}/${name}`);
	}

	/** clears old cache and moves new in its place */
	public roll()
	{
		if (this.rolled)
			return;

		this.rolled = true;
		removeSync(this.oldCacheRoot);
		if (existsSync(this.newCacheRoot)) {
			renameSync(this.newCacheRoot, this.oldCacheRoot);
		}
	}
}
