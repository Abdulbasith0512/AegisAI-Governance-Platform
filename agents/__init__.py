import logging
from typing import Any, Dict
from agents.graph import compiled_graph
from agents.supervisor import parse_supervisor_verdict

logger = logging.getLogger("aegisai.agents.init")

async def run_governance_graph(transaction: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ingests transaction metadata and runs it through the LangGraph AI governance workflow.
    Returns:
        Dict[str, Any]: Execution state and final supervisor results.
    """
    logger.info(f"Initiating agent governance checks for transaction reference: {transaction.get('reference_number')}")
    
    # Execute LangGraph asynchronously
    final_state = await compiled_graph.ainvoke(
        {"transaction": transaction}
    )
    
    supervisor_res = final_state.get("supervisor_result")
    
    if not supervisor_res or supervisor_res.status != "success":
        logger.error("Supervisor Agent failed to resolve a verdict.")
        return {
            "status": "failed",
            "verdict": "declined",
            "trust_score": 0,
            "reasoning": "Internal Agent Framework runtime failure."
        }
        
    # Parse the consolidated verdict with the shared supervisor parser
    # (single implementation — see agents/supervisor.py).
    reasoning_str = supervisor_res.reasoning

    parsed_verdict = parse_supervisor_verdict(supervisor_res)
    trust_score = 0
    clean_reasoning = "System error"

    try:
        parts = reasoning_str.split(" | ")
        for part in parts:
            if part.startswith("trust_score: "):
                trust_score = int(part.replace("trust_score: ", ""))
            elif part.startswith("reasoning: "):
                clean_reasoning = part.replace("reasoning: ", "")
    except Exception as e:
        logger.error(f"Error parsing supervisor reasoning: {e}")
        
    return {
        "status": "success",
        "verdict": parsed_verdict,
        "trust_score": trust_score,
        "reasoning": clean_reasoning,
        "details": {
            "device": final_state.get("device_result"),
            "kyc": final_state.get("kyc_result"),
            "fraud": final_state.get("fraud_result"),
            "aml": final_state.get("aml_result"),
            "policy": final_state.get("policy_result"),
            "explainability": final_state.get("explainability_result")
        }
    }
