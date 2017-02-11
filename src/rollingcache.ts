import * as fs from "fs-extra";
import * as _ from "lodash";

/**
 * Saves data in new cache folder or reads it from old one.
 * Avoids perpetually growing cache and situations when things need to consider changed and then reverted data to be changed.
 */
export class RollingCache <DataType>
{
	private oldCacheRoot: string;
	private newCacheRoot: string;

	/**
	 * @param cacheRoot: root folder for the cache
	 * @param checkNewCache: whether to also look in new cache when reading from cache
	 */
	constructor(private cacheRoot: string, private checkNewCache: boolean)
	{
		this.oldCacheRoot = `${this.cacheRoot}/cache`;
		this.newCacheRoot = `${this.cacheRoot}/cache_`;

		fs.emptyDirSync(this.newCacheRoot);
	}

	/**
	 * @returns true if name exist in old cache (or either old of new cache if checkNewCache is true)
	 */
	public exists(name: string): boolean
	{
		if (this.checkNewCache && fs.existsSync(`${this.newCacheRoot}/${name}`))
			return true;

		return fs.existsSync(`${this.oldCacheRoot}/${name}`);
	}

	/**
	 * @returns true if old cache contains all names and nothing more
	 */
	public match(names: string[]): boolean
	{
		if (!fs.existsSync(this.oldCacheRoot))
			return names.length === 0; // empty folder matches

		return _.isEqual(fs.readdirSync(this.oldCacheRoot).sort(), names.sort());
	}

	/**
	 * @returns data for name, must exist in old cache (or either old of new cache if checkNewCache is true)
	 */
	public read(name: string): DataType
	{
		if (this.checkNewCache && fs.existsSync(`${this.newCacheRoot}/${name}`))
			return fs.readJsonSync(`${this.newCacheRoot}/${name}`, "utf8");

		return fs.readJsonSync(`${this.oldCacheRoot}/${name}`, "utf8");
	}

	public write(name: string, data: DataType): void
	{
		if (data === undefined)
			return;

		if (this.checkNewCache)
			fs.writeJsonSync(`${this.newCacheRoot}/${name}`, data);
		else // won't be reading it this run
			fs.writeJson(`${this.newCacheRoot}/${name}`, data, { encoding: "utf8" }, () => { ; });
	}

	public touch(name: string)
	{
		if (this.checkNewCache)
			fs.ensureFileSync(`${this.newCacheRoot}/${name}`);
		else // won't be reading it this run
			fs.ensureFile(`${this.newCacheRoot}/${name}`, () => { ; });
	}

	/**
	 * clears old cache and moves new in its place
	 */
	public roll()
	{
		fs.remove(this.oldCacheRoot, () =>
		{
			fs.move(this.newCacheRoot, this.oldCacheRoot, () => { ; });
		});
	}
}
