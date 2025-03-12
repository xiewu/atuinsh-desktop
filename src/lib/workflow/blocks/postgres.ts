import { DependencySpec } from "../dependency";
import Block from "./block";

export class PostgresBlock extends Block {
    query: string;
    uri: string;
    autoRefresh: number;

    get typeName() {
        return "postgres";
    }

    constructor(id: string, name: string, dependency: DependencySpec, query: string, uri: string, autoRefresh: number) {
        super(id, name, dependency);

        this.query = query;
        this.uri = uri;
        this.autoRefresh = autoRefresh;
    }

    object() {
        return {
            id: this.id,
            name: this.name,
            query: this.query,
            uri: this.uri,
            autoRefresh: this.autoRefresh,
        };
    }

    serialize() {
        return JSON.stringify(this.object());
    }

    static deserialize(json: string) {
        const data = JSON.parse(json);
        return new PostgresBlock(data.id, data.name, data.dependency, data.query, data.uri, data.autoRefresh);
    }
}