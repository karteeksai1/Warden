# Warden Customer Support Agent (LangGraph)

This directory contains the Python LangGraph customer support agent implementation that interacts with downstream tools through the **Warden MCP Gateway**.

## Features

- **Semantic Discovery:** Discovers domain tools dynamically via `gateway.search_tools` rather than loading all tool definitions into context.
- **Human-in-the-Loop Governance:** Handles asynchronous `PENDING_APPROVAL` states from the gateway, polling `gateway.check_approval` until an operator decides.
- **Security Interception:** Demonstrates real-time mitigation of prompt injections, poisoned tool descriptions, and rug-pull schema mutations.
- **Baseline Comparison:** Run with `--bypass-gateway` to compare behavior, token consumption, and vulnerability exposure directly against an unprotected baseline.

## Demo Scenarios

1. `normal_refund`: Low-value refund under the $50 auto-approval threshold. Auto-approved and issued immediately.
2. `large_refund`: High-value refund ($149.99) requiring human approval, demonstrating the async approval queue and polling workflow.
3. `prompt_injection`: Adversarial customer prompt injection attempt intercepted by the security scanner.
4. `poisoned_tool`: Tool description with concealed steganographic instructions intercepted before agent tool binding.
5. `rug_pull`: Downstream tool schema modification detected via canonical SHA-256 hash mismatch, triggering instant quarantine.

## Usage

```bash
# Install dependencies
pip install -r requirements.txt

# Run standard scenario through Warden Gateway
python support_agent.py --scenario normal_refund

# Run high-value refund with approval loop
python support_agent.py --scenario large_refund

# Run security interception scenarios
python support_agent.py --scenario prompt_injection
python support_agent.py --scenario poisoned_tool
python support_agent.py --scenario rug_pull

# Run all scenarios sequentially
python support_agent.py --scenario all

# Compare against unprotected baseline
python support_agent.py --scenario normal_refund --bypass-gateway
```
