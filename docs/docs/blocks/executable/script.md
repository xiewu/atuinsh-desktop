# Script

<figure><img src="../../../images/CleanShot 2025-02-06 at 23.26.45@2x.png" alt=""><figcaption></figcaption></figure>

The script block is a lot like a terminal block, except non-interactive. This is essentially your normal bash script, with some superpowers

### Supported interpreters

We support several different interpreters with the script block. While we default to \`zsh\`, we also support running code with the following

1. bash
2. python3
3. node

This enables you to solve a wide variety of problems! The current in-use interpreter can be changed via the dropdown in the top right

### Variables

The output of a script block can be captured as a variable, and reused as input for other blocks. All input fields in all blocks are templated.

Set the "output variable" name in the header of the block. You can refer to the variable with the following syntax

```handlebars
{{var.variable_name}}
```

For example

<figure><img src="../../../images/CleanShot 2025-02-06 at 22.56.05@2x.png" alt=""><figcaption><p>A simple example of script block + variable usage</p></figcaption></figure>

See the [templating.md](../../templating.md "mention") section for full info
