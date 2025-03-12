import Block from "./block";

import { TerminalBlock } from "./terminal";
import { ScriptBlock } from "./script";
import { SQLiteBlock } from "./sqlite";
import { ClickhouseBlock } from "./clickhouse";
import { PostgresBlock } from "./postgres";
import { HttpBlock } from "./http";
import { PrometheusBlock } from "./prometheus";

export function blocksBefore(currentId: string,blocks: any[]): Block[]{
    const index = blocks.findIndex((b) => b.id === currentId);
    return blocks.slice(0, index).map((b) => convertBlocknoteToAtuin(b)).filter((b) => b != null);
}

export function convertBlocknoteToAtuin(bnb: any): Block | null {
    if (bnb.type === "run") {
        return new TerminalBlock(bnb.id, bnb.props.name, bnb.props.dependency, bnb.props.code, bnb.props.outputVisible);
    }

    if (bnb.type === "script") {
        return new ScriptBlock(bnb.id, bnb.props.name, bnb.props.dependency, bnb.props.code, bnb.props.interpreter, bnb.props.outputVariable, bnb.props.outputVisible);
    }

    if (bnb.type === "sqlite") {
        return new SQLiteBlock(bnb.id, bnb.props.name, bnb.props.dependency, bnb.props.query, bnb.props.uri, bnb.props.autoRefresh);
    }

    if (bnb.type === "clickhouse") {
        return new ClickhouseBlock(bnb.id, bnb.props.name, bnb.props.dependency, bnb.props.query, bnb.props.uri, bnb.props.autoRefresh);
    }

    if (bnb.type === "postgres") {
        return new PostgresBlock(bnb.id, bnb.props.name, bnb.props.dependency, bnb.props.query, bnb.props.uri, bnb.props.autoRefresh);
    }

    if (bnb.type === "http"){
        return new HttpBlock(bnb.id, bnb.props.name, bnb.props.dependency, bnb.props.url, bnb.props.verb, bnb.props.headers);
    }

    if (bnb.type === "prometheus") {
        return new PrometheusBlock(bnb.id, bnb.props.name, bnb.props.dependency, bnb.props.query, bnb.props.endpoint, bnb.props.period, bnb.props.autoRefresh);
    }

    return null;
}

