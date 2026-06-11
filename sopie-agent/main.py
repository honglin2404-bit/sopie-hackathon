import os
import json
import re
from datetime import datetime
from typing import TypedDict, Optional

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END
from supabase import create_client

from greennode_agentbase import (
    GreenNodeAgentBaseApp,
    RequestContext,
    PingStatus,
    IdentityClient,
)

load_dotenv()

app = GreenNodeAgentBaseApp()

# --- Environment ---
LLM_MODEL = os.environ.get("LLM_MODEL", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")

_missing = [k for k, v in {
    "LLM_MODEL": LLM_MODEL, "LLM_BASE_URL": LLM_BASE_URL,
    "LLM_API_KEY": LLM_API_KEY, "SUPABASE_URL": SUPABASE_URL,
}.items() if not v]
if _missing:
    raise ValueError(f"Missing required environment variables: {', '.join(_missing)}")

llm = ChatOpenAI(
    model=LLM_MODEL,
    base_url=LLM_BASE_URL,
    api_key=LLM_API_KEY,
    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
)

# Retrieve Supabase key from AgentBase Identity at startup (never hardcoded)
print("[startup] Initializing Supabase client via AgentBase Identity...", flush=True)
try:
    _identity_client = IdentityClient()
    _key_result = _identity_client.get_api_key_for_agent_identity(
        provider_name="supabase-key",
        agent_identity_name="sopie-agent",
    )
    supabase = create_client(SUPABASE_URL, _key_result.apikey)
    print("[startup] Supabase client initialized successfully.", flush=True)
except Exception as _e:
    print(f"[startup] FATAL: Failed to initialize Supabase client: {_e}", flush=True)
    raise


# --- Graph State ---
class ResolutionState(TypedDict):
    ticket_text: str
    extracted_context: Optional[dict]
    retrieved_sops: Optional[list]
    selected_sop: Optional[dict]
    reasoning: Optional[dict]
    reply_draft: Optional[str]
    internal_note: Optional[str]


def _parse_json(text: str) -> dict:
    """Extract JSON object from LLM response, handling markdown code fences."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


# --- Node 1: Context Extraction ---
# Role: Senior Customer Service Analyst
# Output: { errorCode, product, transactionType, intent, keyIndicators }
def extract_context(state: ResolutionState) -> dict:
    prompt = f"""You are a Senior Customer Service Analyst at ZaloPay.
Analyze the following customer support ticket and extract structured information.

Ticket:
{state["ticket_text"]}

Return ONLY a valid JSON object with exactly these fields:
{{
  "errorCode": "error/transaction code if mentioned, or null",
  "product": "ZaloPay product area (wallet, payment, lending, promotion, travel, merchant, or general)",
  "transactionType": "transaction type if applicable (transfer, topup, withdrawal, payment, etc.), or null",
  "intent": "what the customer wants in one sentence",
  "keyIndicators": ["list", "of", "key", "symptom", "phrases"]
}}

Only include information explicitly stated in the ticket. Do not infer or guess."""

    response = llm.invoke([HumanMessage(content=prompt)])
    context = _parse_json(response.content)
    if not context:
        context = {
            "errorCode": None,
            "product": "general",
            "transactionType": None,
            "intent": state["ticket_text"][:200],
            "keyIndicators": [],
        }
    return {"extracted_context": context}


# Columns to select from sops table (excludes the large embedding vector)
_SOP_COLS = "id, title, domain, product, cause, solution_l1, solution_l2, keywords_primary, keywords_secondary, link_sop, error_codes, escalation_criteria, resolution_summary, template_app_mail, check_tool_guideline, check_tools_name, check_tools_url"


# --- Node 2: Knowledge Retrieval ---
# Priority: Exact error code match → Semantic search → Keyword fallback
def retrieve_knowledge(state: ResolutionState) -> dict:
    ctx = state["extracted_context"] or {}
    error_code = ctx.get("errorCode")
    intent = ctx.get("intent", "")
    indicators = ctx.get("keyIndicators", [])
    domain = ctx.get("product", "")

    sops = []
    seen_ids: set = set()

    def add_sops(new_sops: list) -> None:
        for s in new_sops:
            sid = str(s.get("id", ""))
            if sid and sid not in seen_ids:
                seen_ids.add(sid)
                sops.append(s)

    # Priority 1: Exact error code match — dedicated error_codes column first, then keywords fallback
    if error_code:
        result = supabase.table("sops").select(_SOP_COLS).ilike(
            "error_codes", f"%{error_code}%"
        ).limit(3).execute()
        add_sops(result.data or [])

        if not sops:
            for kw_col in ("keywords_primary", "keywords_secondary"):
                result = supabase.table("sops").select(_SOP_COLS).ilike(
                    kw_col, f"%{error_code}%"
                ).limit(3).execute()
                add_sops(result.data or [])
        if not sops:
            result = supabase.table("sops").select(_SOP_COLS).ilike(
                "title", f"%{error_code}%"
            ).limit(3).execute()
            add_sops(result.data or [])

    # Priority 2: Domain-filtered keyword search using intent words
    if len(sops) < 5 and domain and domain != "general":
        for col in ("keywords_primary", "title"):
            result = supabase.table("sops").select(_SOP_COLS).eq(
                "domain", domain
            ).limit(5).execute()
            add_sops(result.data or [])
        if len(sops) >= 5:
            return {"retrieved_sops": sops[:5]}

    # Priority 3: Multi-term keyword fallback — search title and keywords_primary
    if len(sops) < 3:
        keywords = [w for w in (intent.split()[:3] + indicators[:2]) if len(w) > 2]
        for kw in keywords[:3]:
            for col in ("title", "keywords_primary"):
                result = supabase.table("sops").select(_SOP_COLS).ilike(
                    col, f"%{kw}%"
                ).limit(3).execute()
                add_sops(result.data or [])
            if len(sops) >= 5:
                break

    return {"retrieved_sops": sops[:5]}


# --- Node 3: Reasoning ---
# Role: Senior Shift Lead
# Output: { issueType, rootCause, recommendedActions[], needEscalation, confidence, bestSopIndex }
def reason(state: ResolutionState) -> dict:
    ctx = state["extracted_context"] or {}
    sops = state["retrieved_sops"] or []

    if sops:
        sops_text = "\n\n".join([
            f"[{i}] {s.get('title', 'Untitled')}\n"
            f"    Domain: {s.get('domain', '')} | Product: {s.get('product', '')}\n"
            f"    Error Codes: {s.get('error_codes', '') or 'N/A'}\n"
            f"    Cause: {s.get('cause', '')}\n"
            f"    Resolution Summary: {s.get('resolution_summary', '') or s.get('solution_l1', '')}\n"
            f"    Escalation Criteria: {s.get('escalation_criteria', '') or 'Not specified'}"
            for i, s in enumerate(sops)
        ])
    else:
        sops_text = "No relevant SOPs found."

    prompt = f"""You are a Senior Shift Lead at ZaloPay Customer Service.

Ticket context:
- Error Code: {ctx.get('errorCode') or 'None'}
- Product: {ctx.get('product')}
- Transaction Type: {ctx.get('transactionType') or 'None'}
- Customer Intent: {ctx.get('intent')}
- Key Indicators: {', '.join(ctx.get('keyIndicators', []))}

Retrieved SOPs (indexed 0 to {len(sops)-1}):
{sops_text}

Dựa chỉ vào context ticket và SOPs ở trên, trả về ONLY một JSON object hợp lệ:
{{
  "issueType": "nhãn phân loại ngắn gọn (tiếng Việt, ví dụ: Lỗi thanh toán voucher)",
  "rootCause": "nguyên nhân gốc trong một câu rõ ràng (tiếng Việt)",
  "recommendedActions": ["bước xử lý 1 (tiếng Việt)", "bước xử lý 2", "bước xử lý 3"],
  "needEscalation": false,
  "confidence": 85,
  "bestSopIndex": 0
}}

Quy tắc:
- bestSopIndex: index 0-based của SOP phù hợp nhất, hoặc -1 nếu không có SOP nào áp dụng
- confidence: 0-100, phản ánh mức độ SOP khớp với ticket
- needEscalation: true chỉ khi CS2 hoặc Engineering phải xử lý case này
- Không được bịa chính sách không có trong các SOP ở trên
- Tất cả các trường văn bản phải viết bằng tiếng Việt"""

    response = llm.invoke([HumanMessage(content=prompt)])
    reasoning = _parse_json(response.content)
    if not reasoning:
        reasoning = {
            "issueType": "unknown",
            "rootCause": "Unable to determine from available SOPs",
            "recommendedActions": ["Escalate to CS2 for manual review"],
            "needEscalation": True,
            "confidence": 0,
            "bestSopIndex": -1,
        }

    best_idx = reasoning.get("bestSopIndex", 0)
    selected_sop = sops[best_idx] if sops and 0 <= best_idx < len(sops) else (sops[0] if sops else None)

    return {"reasoning": reasoning, "selected_sop": selected_sop}


# --- Node 4: Response Generation ---
# Role: Customer Service Specialist
# Output: replyDraft (Vietnamese, customer-facing) + internalNote (Vietnamese, CS team)
def generate_response(state: ResolutionState) -> dict:
    reasoning = state["reasoning"] or {}
    sop = state["selected_sop"] or {}
    ctx = state["extracted_context"] or {}

    # Ưu tiên resolution_summary (ngắn gọn cho AI), fallback sang solution_l1
    sop_solution = sop.get("resolution_summary", "") or sop.get("solution_l1", "")
    sop_detail = sop.get("solution_l2", "")
    sop_escalation = sop.get("escalation_criteria", "")

    prompt = f"""You are a Customer Service Specialist at ZaloPay.

Ticket summary:
- Issue Type: {reasoning.get('issueType')}
- Root Cause: {reasoning.get('rootCause')}
- Recommended Actions: {json.dumps(reasoning.get('recommendedActions', []), ensure_ascii=False)}
- Needs Escalation: {reasoning.get('needEscalation')}
- SOP: {sop.get('title', 'N/A')}
- SOP Solution: {sop_solution}
- SOP Detail: {sop_detail}
- Escalation Criteria: {sop_escalation or 'Not specified'}

Write two outputs in Vietnamese:

1. replyDraft — a professional, empathetic customer reply:
   - Acknowledge the issue
   - Explain the resolution or next step clearly
   - Be concise (3-5 sentences)
   - If escalation needed, tell customer you will follow up

2. internalNote — ghi chú nội bộ cho CS team, theo đúng format sau (tiếng Việt, không dùng label tiếng Anh):

Mô tả vấn đề: [1-2 câu tóm tắt tình huống KH]
Nguyên nhân: [1 câu ngắn gọn]
Hướng xử lý đề xuất: [các bước xử lý theo SOP, viết liền mạch hoặc dạng "Bước 1... Bước 2..."]

Return ONLY a valid JSON object:
{{
  "replyDraft": "customer reply in Vietnamese here",
  "internalNote": "internal note in Vietnamese here — chỉ phần nội dung, không bao gồm UserID/TransID"
}}"""

    response = llm.invoke([HumanMessage(content=prompt)])
    output = _parse_json(response.content)
    if not output:
        output = {
            "replyDraft": response.content,
            "internalNote": f"Root cause: {reasoning.get('rootCause')}. SOP: {sop.get('title', 'N/A')}.",
        }

    return {
        "reply_draft": output.get("replyDraft", ""),
        "internal_note": output.get("internalNote", ""),
    }


# --- Build Graph ---
_builder = StateGraph(ResolutionState)
_builder.add_node("extract_context", extract_context)
_builder.add_node("retrieve_knowledge", retrieve_knowledge)
_builder.add_node("reason", reason)
_builder.add_node("generate_response", generate_response)

_builder.add_edge(START, "extract_context")
_builder.add_edge("extract_context", "retrieve_knowledge")
_builder.add_edge("retrieve_knowledge", "reason")
_builder.add_edge("reason", "generate_response")
_builder.add_edge("generate_response", END)

graph = _builder.compile()


@app.entrypoint
def handler(payload: dict, context: RequestContext) -> dict:
    ticket_text = payload.get("ticket", "").strip()
    if not ticket_text:
        return {"error": "Missing or empty 'ticket' field in request body"}

    try:
        result = graph.invoke({
            "ticket_text": ticket_text,
            "extracted_context": None,
            "retrieved_sops": None,
            "selected_sop": None,
            "reasoning": None,
            "reply_draft": None,
            "internal_note": None,
        })
    except Exception as e:
        return {"error": f"Pipeline failed: {str(e)}"}

    reasoning = result.get("reasoning") or {}
    sop = result.get("selected_sop") or {}

    return {
        "issueType": reasoning.get("issueType", ""),
        "rootCause": reasoning.get("rootCause", ""),
        "confidence": reasoning.get("confidence", 0),
        "needEscalation": reasoning.get("needEscalation", False),
        "recommendedActions": reasoning.get("recommendedActions", []),
        "replyDraft": result.get("reply_draft", ""),
        "internalNote": result.get("internal_note", ""),
        "sourceKnowledge": {
            "id": str(sop.get("id", "")),
            "title": sop.get("title", ""),
            "domain": sop.get("domain", ""),
            "linkSop": sop.get("link_sop", "") or "",
        },
        "toolGuidance": {
            "guideline": sop.get("check_tool_guideline", "") or "",
            "toolsName": sop.get("check_tools_name", "") or "",
            "toolsUrl": sop.get("check_tools_url", "") or "",
        },
        "templateCallChat": sop.get("template_app_mail", "") or "",
        "timestamp": datetime.now().isoformat(),
    }


@app.ping
def health_check() -> PingStatus:
    return PingStatus.HEALTHY


if __name__ == "__main__":
    app.run(port=8080, host="0.0.0.0")
