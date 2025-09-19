---
description: Create dynamic, reusable runbooks with MiniJinja templating system.
---

# Templating

#### **Templates**

Atuin uses [MiniJinja](https://docs.rs/minijinja) for rendering templates, enabling flexible output customization.

**Basic Syntax**

- **Variables**: `{{ var.variable_name }}`
  - Variables can be set by [script.md](blocks/executable/script.md "mention") blocks
- **Filters**: `{{ text | upper }}`, `{{ list | join(", ") }}`
- **Conditionals**:

```django
{% if var.foo %}
echo "foo is true"
{% else %}
echo "foo is false"
{% endif %}
```

- **Loops**:

```django
{% for remote in ["192.168.1.1", "192.168.1.2"] %}
echo "{{ remote }}"
{% endfor %}
```

**Built-in Functions**

- `range(n)`: Generates a sequence → `{% for i in range(3) %}{{ i }}{% endfor %}`
- `length(list)`: Gets list length → `{{ length(users) }}`
- `default(value, fallback)`: Uses fallback if `None` → `{{ user.name | default("Guest") }}`

### Document access

The template system has full access to the entire document - blocks, text, etc.

!!! warning
    We are still iterating on this API, and it is likely to change in future releases

First, give a block a name. Click the pencil icon next to the default name in the top left.

Then, it can be referred to via the `{{ doc.named }}`map, within the template system

<figure>
  <img src="../images/CleanShot 2025-02-06 at 23.41.02@2x.png" alt=""/>
  <figcaption>An example using an editor block's content from another block, via the template system</figcaption>
</figure>
