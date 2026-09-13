from typing import Optional
from app.agents.state import CaseState
from app.agents.nodes import AgentNodes

class ClaimsureAgentGraph:
    def __init__(self, nodes: Optional[AgentNodes] = None):
        self.nodes = nodes or AgentNodes()

    def run(self, initial_state: CaseState) -> CaseState:
        """
        Executes the 9-node state machine workflow from initial state to resolution or pause.
        """
        state = initial_state

        # Node 1: parse_denial
        state = self.nodes.parse_denial(state)

        # Node 2: retrieve_requirements (RAG)
        state = self.nodes.retrieve_requirements(state)

        # If policy retrieval flagged an escalation, stop early and route to abstain
        if state.safety_escalation:
            state.route = "abstain"
            state.status = "ESCALATED"
            state.appeal_letter = (
                f"RE: Urgent Case Escalation - Case {state.case_number}\n\n"
                f"Service: {state.service_type} ({state.service_code})\n"
                f"Payer: {state.payer_id.upper()}\n\n"
                f"SAFETY ESCALATION REASON:\n"
                f"{state.safety_reason or 'Policy coverage rubric missing or clinical safety threshold triggered.'}\n\n"
                f"RECOMMENDED NEXT STEPS:\n"
                f"- Review medical necessity notes manually.\n"
                f"- Contact payer medical director or underwriter if needed."
            )
            return state

        # Node 3: scan_evidence
        state = self.nodes.scan_evidence(state)

        # Node 4: compute_gap (deterministic set diff)
        state = self.nodes.compute_gap(state)

        # Node 5: route (deterministic safety constraints)
        state = self.nodes.route(state)

        if state.route == "abstain":
            # Safety constraint triggered: do not generate automatic appeal
            state.status = "ESCALATED"
            if not state.appeal_letter:
                state.appeal_letter = (
                    f"RE: Case Safety Review - Case {state.case_number}\n\n"
                    f"{state.safety_reason or 'Safety constraint triggered. Automated appeal paused for human review.'}"
                )
            return state

        elif state.route == "await_human":
            # Gap detected: pause for missing records / reviewer input
            state = self.nodes.await_human(state)
            # Assemble citation-backed appeal draft for the reviewer
            state = self.nodes.assemble_appeal(state)
            return state

        elif state.route == "act":
            # Node 6: act (dispatch multi-app notifications & calendar/sheets)
            state = self.nodes.act(state)

            # Node 8: assemble_appeal
            state = self.nodes.assemble_appeal(state)

            # Node 9: verify (agent checks whether actions closed the gap)
            state = self.nodes.verify(state)

            return state

        return state

    def verify_update(self, state: CaseState) -> CaseState:
        """
        Re-triggers verification loop after user uploads missing documents or approves appeal.
        """
        return self.nodes.verify(state)
