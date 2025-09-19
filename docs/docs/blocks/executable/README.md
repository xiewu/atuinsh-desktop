# Executable

Runbooks support a number of executable blocks. These blocks allow you to run scripts on your local machine, and are the building blocks of most workflows.

While the execution context + state of a script or terminal block is isolated and independent, state is pushed down from the runbook.&#x20;

For instance, using a [directory](directory.md "mention") block, you can set the directory that all subsequent blocks should execute within.

### Serial execution

Runbooks also support "serial execution". Click the play button in the top right, and runbooks will execute each block in sequence automatically

<figure><img src="../../../images/CleanShot 2025-04-29 at 15.30.07@2x.png" alt=""><figcaption></figcaption></figure>

There is one small caveat for terminal blocks - they must exit. We cannot automatically determine if a terminal block has completed. You must either click the stop button yourself, or include "exit" somewhere in your input.
