import * as fs from "fs-extra";
import * as _ from "lodash";

export class RollingCache <DataType>
{
	private oldCacheRoot: string;
	private newCacheRoot: string;

	constructor(private cacheRoot: string, private checkNewCache: boolean)
	{
		this.oldCacheRoot = `${this.cacheRoot}/cache`;
		this.newCacheRoot = `${this.cacheRoot}/cache_`;

		fs.emptyDirSync(this.newCacheRoot);
	}

	public exists(name: string): boolean
	{
		if (this.checkNewCache && fs.existsSync(`${this.newCacheRoot}/${name}`))
			return true;

		return fs.existsSync(`${this.oldCacheRoot}/${name}`);
	}

	public match(names: string[]): boolean
	{
		if (!fs.existsSync(this.oldCacheRoot))
			return false;

		return _.isEqual(fs.readdirSync(this.oldCacheRoot).sort(), names.sort());
	}

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

		fs.writeJson(`${this.newCacheRoot}/${name}`, data, { encoding: "utf8" }, () => {});
	}

	public touch(name: string)
	{
		fs.ensureFile(`${this.newCacheRoot}/${name}`, () => {});
	}

	public roll()
	{
		fs.remove(this.oldCacheRoot, () =>
		{
			fs.move(this.newCacheRoot, this.oldCacheRoot, () => {} );
		});
	}
}
