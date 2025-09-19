# MySQL

The MySQL block allows you to connect to MySQL databases and execute queries directly within your runbook.

### Connection

Configure your MySQL connection using standard connection parameters:

- **Host** - MySQL server hostname or IP
- **Port** - MySQL server port (default: 3306)
- **Database** - Target database name
- **Username** - MySQL username
- **Password** - MySQL password

### Query Execution

Write and execute SQL queries against your MySQL database. Results are displayed in a table format within the runbook.

### Template Usage

All input fields are first rendered by the [templating](../../templating.md "mention") system, allowing you to use variables in your queries and connection parameters.

```sql
SELECT * FROM users WHERE status = '{{var.user_status}}';
```

### Security

Consider using [secrets](../../secrets.md "mention") for sensitive connection parameters like passwords to avoid storing credentials in plain text.
