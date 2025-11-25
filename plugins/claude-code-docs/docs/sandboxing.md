[​

](#overview)

## Overview

Claude Code features native sandboxing to provide a more secure environment for agent execution while reducing the need for constant permission prompts. Instead of asking permission for each bash command, sandboxing creates defined boundaries upfront where Claude Code can work more freely with reduced risk. The sandboxed bash tool uses OS-level primitives to enforce both filesystem and network isolation.

[​

](#why-sandboxing-matters)

## Why sandboxing matters

Traditional permission-based security requires constant user approval for bash commands. While this provides control, it can lead to:

- **Approval fatigue**: Repeatedly clicking “approve” can cause users to pay less attention to what they’re approving
- **Reduced productivity**: Constant interruptions slow down development workflows
- **Limited autonomy**: Claude Code cannot work as efficiently when waiting for approvals

Sandboxing addresses these challenges by:

1. **Defining clear boundaries**: Specify exactly which directories and network hosts Claude Code can access
2. **Reducing permission prompts**: Safe commands within the sandbox don’t require approval
3. **Maintaining security**: Attempts to access resources outside the sandbox trigger immediate notifications
4. **Enabling autonomy**: Claude Code can run more independently within defined limits

Effective sandboxing requires **both** filesystem and network isolation. Without network isolation, a compromised agent could exfiltrate sensitive files like SSH keys. Without filesystem isolation, a compromised agent could backdoor system resources to gain network access. When configuring sandboxing it is important to ensure that your configured settings do not create bypasses in these systems.

[​

](#how-it-works)

## How it works

###

[​

](#filesystem-isolation)

Filesystem isolation

The sandboxed bash tool restricts file system access to specific directories:

- **Default writes behavior**: Read and write access to the current working directory and its subdirectories
- **Default read behavior**: Read access to the entire computer, except certain denied directories
- **Blocked access**: Cannot modify files outside the current working directory without explicit permission
- **Configurable**: Define custom allowed and denied paths through settings

###

[​

](#network-isolation)

Network isolation

Network access is controlled through a proxy server running outside the sandbox:

- **Domain restrictions**: Only approved domains can be accessed
- **User confirmation**: New domain requests trigger permission prompts
- **Custom proxy support**: Advanced users can implement custom rules on outgoing traffic
- **Comprehensive coverage**: Restrictions apply to all scripts, programs, and subprocesses spawned by commands

###

[​

](#os-level-enforcement)

OS-level enforcement

The sandboxed bash tool leverages operating system security primitives:

- **Linux**: Uses [bubblewrap](https://github.com/containers/bubblewrap) for isolation
- **macOS**: Uses Seatbelt for sandbox enforcement

These OS-level restrictions ensure that all child processes spawned by Claude Code’s commands inherit the same security boundaries.

[​

](#getting-started)

## Getting started

###

[​

](#enable-sandboxing)

Enable sandboxing

You can enable sandboxing by running the `/sandbox` slash command:

Copy

Ask AI

```
> /sandbox
```

This activates the sandboxed bash tool with default settings, allowing access to your current working directory while blocking access to sensitive system locations.

###

[​

](#configure-sandboxing)

Configure sandboxing

Customize sandbox behavior through your `settings.json` file. See [Settings](settings.md#sandbox-settings) for complete configuration reference.

Not all commands are compatible with sandboxing out of the box. Some notes that may help you make the most out of the sandbox:

- Many CLI tools require accessing certain hosts. As you use these tools, they will request permission to access certain hosts. Granting permission will allow them to access these hosts now and in the future, enabling them to safely execute inside the sandbox.
- `watchman` is incompatible with running in the sandbox. If you’re running `jest`, consider using `jest --no-watchman`
- `docker` is incompatible with running in the sandbox. Consider specifying `docker` in `excludedCommands` to force it to run outside of the sandbox.

Claude Code includes an intentional escape hatch mechanism that allows commands to run outside the sandbox when necessary. When a command fails due to sandbox restrictions (such as network connectivity issues or incompatible tools), Claude is prompted to analyze the failure and may retry the command with the `dangerouslyDisableSandbox` parameter. Commands that use this parameter go through the normal Claude Code permissions flow requiring user permission to execute. This allows Claude Code to handle edge cases where certain tools or network operations cannot function within sandbox constraints.You can disable this escape hatch by setting `"allowUnsandboxedCommands": false` in your [sandbox settings](settings.md#sandbox-settings). When disabled, the `dangerouslyDisableSandbox` parameter is completely ignored and all commands must run sandboxed or be explicitly listed in `excludedCommands`.

[​

](#security-benefits)

## Security benefits

###

[​

](#protection-against-prompt-injection)

Protection against prompt injection

Even if an attacker successfully manipulates Claude Code’s behavior through prompt injection, the sandbox ensures your system remains secure: **Filesystem protection:**

- Cannot modify critical config files such as `~/.bashrc`
- Cannot modify system-level files in `/bin/`
- Cannot read files that are denied in your [Claude permission settings](iam.md#configuring-permissions)

**Network protection:**

- Cannot exfiltrate data to attacker-controlled servers
- Cannot download malicious scripts from unauthorized domains
- Cannot make unexpected API calls to unapproved services
- Cannot contact any domains not explicitly allowed

**Monitoring and control:**

- All access attempts outside the sandbox are blocked at the OS level
- You receive immediate notifications when boundaries are tested
- You can choose to deny, allow once, or permanently update your configuration

###

[​

](#reduced-attack-surface)

Reduced attack surface

Sandboxing limits the potential damage from:

- **Malicious dependencies**: NPM packages or other dependencies with harmful code
- **Compromised scripts**: Build scripts or tools with security vulnerabilities
- **Social engineering**: Attacks that trick users into running dangerous commands
- **Prompt injection**: Attacks that trick Claude into running dangerous commands

###

[​

](#transparent-operation)

Transparent operation

When Claude Code attempts to access network resources outside the sandbox:

1. The operation is blocked at the OS level
2. You receive an immediate notification
3. You can choose to:
    - Deny the request
    - Allow it once
    - Update your sandbox configuration to permanently allow it

[​

](#security-limitations)

## Security Limitations

- Network Sandboxing Limitations: The network filtering system operates by restricting the domains that processes are allowed to connect to. It does not otherwise inspect the traffic passing through the proxy and users are responsible for ensuring they only allow trusted domains in their policy.

Users should be aware of potential risks that come from allowing broad domains like `github.com` that may allow for data exfiltration. Also, in some cases it may be possible to bypass the network filtering through [domain fronting](https://en.wikipedia.org/wiki/Domain_fronting).

- Privilege Escalation via Unix Sockets: The `allowUnixSockets` configuration can inadvertently grant access to powerful system services that could lead to sandbox bypasses. For example, if it is used to allow access to `/var/run/docker.sock` this would effectively grant access to the host system through exploiting the docker socket. Users are encouraged to carefully consider any unix sockets that they allow through the sandbox.
- Filesystem Permission Escalation: Overly broad filesystem write permissions can enable privilege escalation attacks. Allowing writes to directories containing executables in `$PATH`, system configuration directories, or user shell configuration files (`.bashrc`, `.zshrc`) can lead to code execution in different security contexts when other users or system processes access these files.
- Linux Sandbox Strength: The Linux implementation provides strong filesystem and network isolation but includes an `enableWeakerNestedSandbox` mode that enables it to work inside of Docker environments without privileged namespaces. This option considerably weakens security and should only be used incases where additional isolation is otherwise enforced.

[​

](#advanced-usage)

## Advanced usage

###

[​

](#custom-proxy-configuration)

Custom proxy configuration

For organizations requiring advanced network security, you can implement a custom proxy to:

- Decrypt and inspect HTTPS traffic
- Apply custom filtering rules
- Log all network requests
- Integrate with existing security infrastructure

Copy

Ask AI

```
{
  "sandbox": {
    "network": {
      "httpProxyPort": 8080,
      "socksProxyPort": 8081
    }
  }
}
```

###

[​

](#integration-with-existing-security-tools)

Integration with existing security tools

The sandboxed bash tool works alongside:

- **IAM policies**: Combine with [permission settings](iam.md) for defense-in-depth
- **Development containers**: Use with [devcontainers](devcontainer.md) for additional isolation
- **Enterprise policies**: Enforce sandbox configurations through [managed settings](settings.md#settings-precedence)

[​

](#best-practices)

## Best practices

1. **Start restrictive**: Begin with minimal permissions and expand as needed
2. **Monitor logs**: Review sandbox violation attempts to understand Claude Code’s needs
3. **Use environment-specific configs**: Different sandbox rules for development vs. production contexts
4. **Combine with permissions**: Use sandboxing alongside IAM policies for comprehensive security
5. **Test configurations**: Verify your sandbox settings don’t block legitimate workflows

[​

](#open-source)

## Open source

The sandbox runtime is available as an open source npm package for use in your own agent projects. This enables the broader AI agent community to build safer, more secure autonomous systems. This can also be used to sandbox other programs you may wish to run. For example, to sandbox an MCP server you could run:

Copy

Ask AI

```
npx @anthropic-ai/sandbox-runtime <command-to-sandbox>
```

For implementation details and source code, visit the [GitHub repository](https://github.com/anthropic-experimental/sandbox-runtime).

[​

](#limitations)

## Limitations

- **Performance overhead**: Minimal, but some filesystem operations may be slightly slower
- **Compatibility**: Some tools that require specific system access patterns may need configuration adjustments, or may even need to be run outside of the sandbox
- **Platform support**: Currently supports Linux and macOS; Windows support planned

[​

](#see-also)

## See also

- [Security](security.md) - Comprehensive security features and best practices
- [IAM](iam.md) - Permission configuration and access control
- [Settings](settings.md) - Complete configuration reference
- [CLI reference](cli-reference.md) - Command-line options including `-sb`

[Development containers](devcontainer.md)

⌘I