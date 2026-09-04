import abc
import asyncio
import logging
import time
from typing import Any, Dict, List
from pydantic import BaseModel, Field

# Setup core agent logger
logger = logging.getLogger("aegisai.agents")

class AgentResponse(BaseModel):
    """
    Standard schema exposed by all AegisAI agents.

    Core fields (status/confidence/reasoning/timing/logs) are always
    present. Structured fields (risk_score/flags/evidence) are populated
    by agents that compute them; agents running deterministic heuristics
    set placeholder=True with a model label instead of implying ML.
    """
    status: str = Field(..., description="Execution status: 'success' or 'failed'.")
    agent_name: str = Field(default="", description="Name of the executing agent.")
    confidence_score: float = Field(..., description="Normalized confidence probability (0.0 to 1.0).")
    risk_score: float = Field(default=0.0, description="Normalized risk probability (0.0 to 1.0).")
    flags: List[str] = Field(default_factory=list, description="Machine-readable risk flag codes.")
    evidence: Dict[str, Any] = Field(default_factory=dict, description="Structured supporting evidence.")
    model: str = Field(default="", description="Model/heuristic identifier, e.g. 'rf-gbc-ensemble-v1' or 'heuristic-v1'.")
    placeholder: bool = Field(default=False, description="True when the output is a deterministic placeholder, not an ML prediction.")
    reasoning: str = Field(..., description="Plain-text justification of decision verdict.")
    execution_time: float = Field(..., description="Agent processing runtime duration in seconds.")
    logs: List[str] = Field(default_factory=list, description="Execution logging traces and warnings.")

class BaseGovernanceAgent(abc.ABC):
    """
    Abstract base class enforcing standard agent properties, logging, and retry logic.
    """
    def __init__(self, name: str, max_retries: int = 3, backoff_seconds: float = 0.5) -> None:
        self.name: str = name
        self.max_retries: int = max_retries
        self.backoff_seconds: float = backoff_seconds
        self.agent_logger = logging.getLogger(f"aegisai.agents.{name}")

    async def run(self, state: Dict[str, Any]) -> AgentResponse:
        """
        Main runner coordinating timing, standard error logging, and retry loops.
        Emits agent.started / agent.completed / agent.failed execution events
        (no-op when no transaction is bound to the event bus).
        """
        from app.services.event_bus import emit_event, AGENT_STARTED, AGENT_COMPLETED, AGENT_FAILED

        logs: List[str] = []
        start_time = time.perf_counter()

        await emit_event(AGENT_STARTED, "running", agent=self.name)
        attempt = 0
        while attempt < self.max_retries:
            try:
                attempt += 1
                logs.append(f"Starting execution attempt {attempt}...")
                
                # Execute agent-specific logic
                result = await self._execute(state, logs)
                
                end_time = time.perf_counter()
                execution_time = end_time - start_time
                logs.append("Execution completed successfully.")

                await emit_event(
                    AGENT_COMPLETED,
                    "success",
                    agent=self.name,
                    metadata={"execution_time_s": round(execution_time, 4)},
                )
                return AgentResponse(
                    status="success",
                    agent_name=self.name,
                    confidence_score=result.get("confidence_score", 1.0),
                    risk_score=float(result.get("risk_score", 0.0)),
                    flags=list(result.get("flags", [])),
                    evidence=dict(result.get("evidence", {})),
                    model=str(result.get("model", "")),
                    placeholder=bool(result.get("placeholder", False)),
                    reasoning=result.get("reasoning", "No reasons specified."),
                    execution_time=execution_time,
                    logs=logs
                )
            except Exception as e:
                self.agent_logger.warning(f"Attempt {attempt} failed: {e}")
                logs.append(f"Attempt {attempt} failed: {str(e)}")
                if attempt >= self.max_retries:
                    end_time = time.perf_counter()
                    execution_time = end_time - start_time
                    logs.append("Maximum execution retries exceeded. Failing.")
                    await emit_event(
                        AGENT_FAILED,
                        "failed",
                        agent=self.name,
                        metadata={"error": str(e), "attempts": attempt},
                    )
                    return AgentResponse(
                        status="failed",
                        agent_name=self.name,
                        confidence_score=0.0,
                        risk_score=1.0,
                        flags=["agent_failure"],
                        evidence={"error": str(e), "attempts": attempt},
                        model="",
                        placeholder=False,
                        reasoning=f"Agent runtime failure: {str(e)}",
                        execution_time=execution_time,
                        logs=logs
                    )
                # Exponential backoff sleep
                await asyncio.sleep(self.backoff_seconds * (2 ** (attempt - 1)))

    @abc.abstractmethod
    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        """
        Core logic to be implemented by child classes.
        """
        pass
