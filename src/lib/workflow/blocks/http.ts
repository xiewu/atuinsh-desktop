import { DependencySpec } from "../dependency";
import Block from "./block";

export enum HttpVerb {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
    HEAD = "HEAD",
}

export type HttpHeaders = { [key: string]: string };

export class HttpBlock extends Block {
    url: string;
    verb: HttpVerb;
    headers: HttpHeaders;

    get typeName() {
        return "http";
    }

    constructor(
        id: string, 
        name: string, 
        dependency: DependencySpec,
        url: string, 
        verb: HttpVerb = HttpVerb.GET, 
        headers: HttpHeaders = {}
    ) {
        super(id, name, dependency);

        this.url = url;
        this.verb = verb;
        this.headers = headers;
    }

    object() {
        let obj = {
            id: this.id,
            name: this.name,
            url: this.url,
            verb: this.verb,
            headers: this.headers,
        };
        return obj;
    }

    serialize() {
        return JSON.stringify(this.object());
    }
    
    static deserialize(json: string) {
        const data = JSON.parse(json);
        return new HttpBlock(
            data.id, 
            data.name, 
            data.dependency,
            data.url, 
            data.verb, 
            JSON.parse(data.headers)
        );
    }
}

export interface HttpResponse {
    status: number;
    statusText: string;
    headers: { [key: string]: string };
    duration: number;
    time: Date;
} 
