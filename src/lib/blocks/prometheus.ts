import Block from "./block";

export class PrometheusBlock extends Block {
    id: string;
    name: string;
    query: string;
    endpoint: string;
    period: string;
    autoRefresh: boolean;

    get typeName() {
        return "prometheus";
    }

    constructor(
        id: string, 
        name: string = "Prometheus", 
        query: string = "", 
        endpoint: string = "", 
        period: string = "1h", 
        autoRefresh: boolean = false
    ) {
        super();

        this.id = id;
        this.name = name;
        this.query = query;
        this.endpoint = endpoint;
        this.period = period;
        this.autoRefresh = autoRefresh;
    }

    serialize() {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            query: this.query,
            endpoint: this.endpoint,
            period: this.period,
            autoRefresh: this.autoRefresh,
        });
    }
    
    static deserialize(json: string) {
        const data = JSON.parse(json);
        return new PrometheusBlock(
            data.id, 
            data.name, 
            data.query, 
            data.endpoint, 
            data.period, 
            data.autoRefresh
        );
    }
} 