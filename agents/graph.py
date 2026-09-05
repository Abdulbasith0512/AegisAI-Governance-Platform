from typing import Any, Dict, TypedDict
from langgraph.graph import StateGraph, START, END

from agents.base import AgentResponse
from agents.device import DeviceAgent
from agents.kyc import KYCAgent
from agents.fraud import FraudAgent
from agents.aml import AMLAgent
from agents.policy import PolicyAgent
from agents.explainability import ExplainabilityAgent
from agents.supervisor import SupervisorAgent

class AgentGraphState(TypedDict):
    """
    State schemas maintained across graph executions.
    """
    transaction: Dict[str, Any]
    device_result: AgentResponse
    kyc_result: AgentResponse
    fraud_result: AgentResponse
    aml_result: AgentResponse
    policy_result: AgentResponse
    explainability_result: AgentResponse
    supervisor_result: AgentResponse


class AgentGraphSideChannel(TypedDict, total=False):
    """
    Agent-produced evidence bundles. Declared (not inferred) because
    LangGraph drops node updates whose keys are missing from the schema.
    """
    device_prob: float
    kyc_prob: float
    fraud_prob: float
    behavior_prob: float
    aml_prob: float
    fraud_features: Dict[str, Any]
    behavior_features: Dict[str, Any]
    policy_simulation: Dict[str, Any]
    explanation_data: Dict[str, Any]
    trust_score_value: int
    trust_weights: Dict[str, Any]
    trust_reasons: Dict[str, Any]
    consensus_ratio: float
    consensus_votes: Dict[str, Any]
    supervisor_decision: Dict[str, Any]
    decision_explanation: Dict[str, Any]


class AgentGraphFullState(AgentGraphState, AgentGraphSideChannel):
    """Complete graph state: required results plus optional evidence."""

# Initialize nodes as instances
device_agent = DeviceAgent()
kyc_agent = KYCAgent()
fraud_agent = FraudAgent()
aml_agent = AMLAgent()
policy_agent = PolicyAgent()
explain_agent = ExplainabilityAgent()
supervisor_agent = SupervisorAgent()

# Define Async Node functions mapping state mutations
# NOTE (langgraph>=1.x): node inputs are snapshots — in-place mutations an
# agent makes to `state` (trust scores, evidence bundles, decision dicts)
# are DISCARDED unless returned. Each wrapper therefore diffs top-level
# keys and returns every addition so downstream nodes, the endpoint, and
# persistence actually receive them.
async def _run_agent(agent, result_key: str, state: AgentGraphState) -> Dict[str, Any]:
    before = set(state.keys())
    res = await agent.run(state)
    updates = {key: state[key] for key in state.keys() - before}
    updates[result_key] = res
    return updates

async def run_device_agent(state: AgentGraphState) -> Dict[str, Any]:
    return await _run_agent(device_agent, "device_result", state)

async def run_kyc_agent(state: AgentGraphState) -> Dict[str, Any]:
    return await _run_agent(kyc_agent, "kyc_result", state)

async def run_fraud_agent(state: AgentGraphState) -> Dict[str, Any]:
    return await _run_agent(fraud_agent, "fraud_result", state)

async def run_aml_agent(state: AgentGraphState) -> Dict[str, Any]:
    return await _run_agent(aml_agent, "aml_result", state)

async def run_policy_agent(state: AgentGraphState) -> Dict[str, Any]:
    return await _run_agent(policy_agent, "policy_result", state)

async def run_explainability_agent(state: AgentGraphState) -> Dict[str, Any]:
    return await _run_agent(explain_agent, "explainability_result", state)

async def run_supervisor_agent(state: AgentGraphState) -> Dict[str, Any]:
    return await _run_agent(supervisor_agent, "supervisor_result", state)

# Construct the StateGraph
workflow = StateGraph(AgentGraphFullState)

# Register Nodes
workflow.add_node("device_node", run_device_agent)
workflow.add_node("kyc_node", run_kyc_agent)
workflow.add_node("fraud_node", run_fraud_agent)
workflow.add_node("aml_node", run_aml_agent)
workflow.add_node("policy_node", run_policy_agent)
workflow.add_node("explainability_node", run_explainability_agent)
workflow.add_node("supervisor_node", run_supervisor_agent)

# Set Flow Transitions
# Execution sequence: START -> Device -> KYC -> Fraud -> AML -> Policy -> Explainability -> Supervisor -> END
workflow.add_edge(START, "device_node")
workflow.add_edge("device_node", "kyc_node")
workflow.add_edge("kyc_node", "fraud_node")
workflow.add_edge("fraud_node", "aml_node")
workflow.add_edge("aml_node", "policy_node")
workflow.add_edge("policy_node", "explainability_node")
workflow.add_edge("explainability_node", "supervisor_node")
workflow.add_edge("supervisor_node", END)

# Compile Graph
compiled_graph = workflow.compile()
