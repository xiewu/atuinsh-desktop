# SSH

SSH is another "contextual" block - just like setting a directory or environment variable.

<figure><img src="../../../images/CleanShot 2025-04-29 at 00.51.47@2x.png" alt=""><figcaption><p>Example SSH block usage</p></figcaption></figure>

Insert an SSH block, and fill in the host. All following [terminal](../executable/terminal.md "mention") or [script](../executable/script.md "mention") blocks will now execute on the remote machine. If the block is going to execute on a remote machine, it will be outlined in blue.

### Authentication

We do not yet support specifying authentication, and only connect using the local SSH agent. Tailscale SSH works as expected.

### Running locally

If you wish to revert back to local execution, insert a "host" block.

<figure><img src="../../../images/CleanShot 2025-04-29 at 00.56.18@2x.png" alt=""><figcaption></figcaption></figure>

In the future, the host block will support toggling between different connected machines. Right now, it only supports localhost

### Connection pooling

Our SSH integration will only open a single SSH connection, and multiplex multiple sessions through it. This means that once connected, block execution will feel fast + low latency
