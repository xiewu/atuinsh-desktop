// Prompt builder for BlockNote AI extension  
export const promptBuilder = (opts: any) => {
  return `You are an expert at creating runbook blocks for operational tasks.

Available block types and their properties:
- run: Terminal commands (code, name)
- script: Shell scripts (code, name, lang) 
- env: Environment variables (name, value)
- var: Template variables (name, value)
- directory: Directory changes (path)
- http: HTTP requests (url, method, headers, body)
- ssh-connect: SSH connections (host, user, port)
- prometheus: Prometheus queries (query, url)
- sqlite/postgres/clickhouse: Database queries
- editor: Code editors (code, lang)
- paragraph: Text content
- heading: Section headers

User request: ${opts.prompt || opts}

Generate practical, executable blocks with clear names and helpful descriptions.`;
};
