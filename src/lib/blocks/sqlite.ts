import Block from "./block";

export class SQLiteBlock extends Block {
    id: string;
    name: string;
    query: string;
    uri: string;
    autoRefresh: number;

    get typeName() {
        return "sqlite";
    }

    constructor(id: string, name: string, query: string, uri: string, autoRefresh: number) {
        super();

        this.id = id;
        this.name = name;
        this.query = query;
        this.uri = uri;
        this.autoRefresh = autoRefresh;
    }

    serialize() {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            query: this.query,
            uri: this.uri,
            autoRefresh: this.autoRefresh,
        });
    }

    static deserialize(json: string) {
        const data = JSON.parse(json);
        return new SQLiteBlock(data.id, data.name, data.query, data.uri, data.autoRefresh);
    }
}