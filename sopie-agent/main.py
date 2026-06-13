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
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

_missing = [k for k, v in {
    "LLM_MODEL": LLM_MODEL, "LLM_BASE_URL": LLM_BASE_URL,
    "LLM_API_KEY": LLM_API_KEY, "SUPABASE_URL": SUPABASE_URL,
}.items() if not v]
if _missing:
    raise ValueError(f"Missing required environment variables: {', '.join(_missing)}")

# Fast LLM — used for extract_context and generate_response
llm = ChatOpenAI(
    model=LLM_MODEL,
    base_url=LLM_BASE_URL,
    api_key=LLM_API_KEY,
    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
)

print(f"[startup] llm={LLM_MODEL}", flush=True)

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
    action_type: Optional[str]
    routing_level: Optional[int]
    customerTone: Optional[str]
    template_adapted: Optional[str]


def _parse_json(text: str) -> dict:
    """Extract JSON object from LLM response, handling markdown code fences."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


def _preparse_fd_ticket(text: str) -> dict:
    """Parse structured fields from FD ticket template using regex.
    Handles both '+ Field: value' and '+ Field:\\nvalue' patterns.
    Returns only fields that are explicitly present — never guesses."""
    def get_field(*labels):
        for label in labels:
            pattern = rf'(?:^|\n)\+?\s*{re.escape(label)}\s*[:：]\s*(.+?)(?=\n\+|\n\n|$)'
            m = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if m:
                val = m.group(1).strip()
                if val and val.lower() not in ('undefined', 'null', '-', ''):
                    return val
        return None

    # Extract BC code — format: LABEL(-5077) or bare -5077
    bc_raw = get_field("Mã lỗi BC", "Trạng thái BC")
    bc_code = None
    if bc_raw:
        m = re.search(r'\((-?\d+)\)', bc_raw)
        if m:
            bc_code = m.group(1)
        else:
            m = re.search(r'(-?\d{4,})', bc_raw)
            if m:
                bc_code = m.group(1)

    # Extract TPE code — format: "-217 Thất bại" → "-217"
    tpe_raw = get_field("Mã lỗi TPE", "TPE")
    tpe_code = None
    if tpe_raw:
        m = re.search(r'(-?\d+)', tpe_raw)
        if m:
            tpe_code = m.group(1)

    # Step result — only real infocodes (6 digits), NOT bc_code leaked here
    step_raw = get_field("Step result", "Step Result")
    step_result = None
    if step_raw:
        m = re.search(r'(\d{6,})', step_raw)  # 6+ digits = real infocode like 210000
        step_result = m.group(1) if m else None

    # Detect product from channel field
    channel = get_field("Kênh thanh toán")
    product_type = None
    if channel:
        cl = channel.lower()
        if any(x in cl for x in ["viettel", "vinaphone", "mobifone", "telco"]):
            product_type = "TE"
        elif any(x in cl for x in ["hóa đơn", "billing"]):
            product_type = "BI"

    return {
        "user_id": get_field("UserID", "User ID"),
        "trans_id": get_field("TransID", "Trans ID", "Mã GD"),
        "channel": channel,
        "transaction_time": get_field("Thời gian giao dịch"),
        "tpe_code": tpe_code,
        "step_result": step_result,
        "bc_code": bc_code,
        "description": get_field("Mô tả"),
        "extra_info": get_field("Thông tin thêm"),
        "product_type": product_type,
    }


# --- Node 1: Context Extraction ---
# Role: Senior Customer Service Analyst
def extract_context(state: ResolutionState) -> dict:
    preparsed = _preparse_fd_ticket(state["ticket_text"])
    print(f"[preparse] {preparsed}", flush=True)
    preparsed_summary = {k: v for k, v in preparsed.items() if v}

    prompt = f"""You are a Senior Customer Service Analyst at ZaloPay.
Analyze the following customer support ticket and extract structured information.

Ticket:
{state["ticket_text"]}

Pre-parsed fields (already extracted, do NOT override these): {json.dumps(preparsed_summary, ensure_ascii=False)}
Focus on extracting: intent, keyIndicators, transactionType, product from the Mô tả and Thông tin thêm fields.

Return ONLY a valid JSON object with exactly these fields:
{{
  "errorCode": "error/transaction code if mentioned, or null",
  "product": "ZaloPay product area (wallet, payment, lending, promotion, travel, merchant, or general)",
  "transactionType": "transaction type if applicable (transfer, topup, withdrawal, payment, etc.), or null",
  "intent": "what the customer wants in one sentence",
  "keyIndicators": ["list", "of", "key", "symptom", "phrases"],
  "bc_code": "BC error code e.g. -5077 or -5218 (only if explicitly stated, else null)",
  "tpe_code": "TPE error code e.g. -348 or -374 (only if explicitly stated, else null)",
  "step_result": "infocode from TPE step result e.g. 210000 or 210800 (only if explicitly stated, else null)",
  "mc_status": "current CPS mc_status value e.g. -400 or -53 (only if explicitly stated, else null)",
  "mc_status_updated": "updated mc_status after action e.g. 1 or -402 (only if explicitly stated, else null)",
  "routingProduct": "TE if Telco payment, BI if Billing/invoice payment (only if identifiable, else null)",
  "userId": "UserID / UID of the customer if mentioned, else null",
  "transId": "TransactionID / TransID / GD code if mentioned, else null",
  "customerTone": "one of: binh_thuong | kho_chiu | gay_gat | de_doa"
}}

customerTone detection rules:
- binh_thuong: neutral, asking normally
- kho_chiu: frustrated words like "mãi không được", "sao vậy", "tệ quá", "lâu quá"
- gay_gat: profanity, "lừa đảo", "kiện", "tôi sẽ kiện", angry ALL CAPS
- de_doa: "report", "lên mạng xã hội", "báo chí", threats to escalate publicly

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
            "customerTone": "binh_thuong",
        }

    # Preparsed values take priority over LLM-guessed values
    if preparsed.get("bc_code"):      context["bc_code"] = preparsed["bc_code"]
    if preparsed.get("tpe_code"):     context["tpe_code"] = preparsed["tpe_code"]
    if preparsed.get("step_result"):  context["step_result"] = preparsed["step_result"]
    if preparsed.get("user_id"):      context["userId"] = preparsed["user_id"]
    if preparsed.get("trans_id"):     context["transId"] = preparsed["trans_id"]
    if preparsed.get("product_type"): context["routingProduct"] = preparsed["product_type"]

    return {
        "extracted_context": context,
        "customerTone": context.get("customerTone") or "binh_thuong",
    }


# Columns to select from sops table (excludes the large embedding vector)
_SOP_COLS = "id, title, domain, product, cause, solution_l1, solution_l2, keywords_primary, keywords_secondary, link_sop, error_codes, escalation_criteria, resolution_summary, template_app_mail, check_tool_guideline, check_tools_name, check_tools_url"

# Embedding client for semantic search — must use text-embedding-3-small (1536d)
# to match the dimension of existing sop_embeddings stored in Supabase.
_embed_client = None
if OPENAI_API_KEY:
    from openai import OpenAI as _OpenAI
    _embed_client = _OpenAI(api_key=OPENAI_API_KEY)
    print("[startup] OpenAI embedding client initialized (text-embedding-3-small).", flush=True)
else:
    print("[startup] OPENAI_API_KEY not set — semantic search disabled, using keyword-only retrieval.", flush=True)


def _semantic_search(intent: str, limit: int = 5) -> list:
    """Embed intent with text-embedding-3-small and search pgvector via match_sops RPC.

    Falls back silently to an empty list if the embed client is unavailable,
    OPENAI_API_KEY is missing, or the match_sops function does not exist.
    """
    if not _embed_client or not intent:
        return []
    try:
        emb_resp = _embed_client.embeddings.create(
            model="text-embedding-3-small",
            input=intent[:500],
        )
        vec = emb_resp.data[0].embedding
        rpc_result = supabase.rpc(
            "match_sops",
            {"query_embedding": vec, "match_threshold": 0.3, "match_count": limit},
        ).execute()
        ids = [row["id"] for row in (rpc_result.data or []) if row.get("id")]
        if not ids:
            return []
        # Fetch full rows from sops table — match_sops result omits error_codes,
        # escalation_criteria, resolution_summary which are needed for reasoning.
        full = supabase.table("sops").select(_SOP_COLS).in_("id", ids).execute()
        return full.data or []
    except Exception as e:
        print(f"[semantic_search] warn: {e}", flush=True)
        return []


def _error_routing_lookup(bc_code, tpe_code, step_result, mc_status, mc_status_updated, product):
    """Deterministic lookup in error_routing table. Returns (sop_data, action_type, level)."""
    try:
        query = supabase.table("error_routing").select("sop_id, action_type, level, note")

        if bc_code:
            query = query.eq("bc_code", bc_code)
        elif tpe_code:
            query = query.eq("tpe_code", tpe_code)
            if step_result:
                query = query.eq("step_result", step_result)
            if mc_status:
                query = query.eq("mc_status", mc_status)
            if mc_status_updated:
                query = query.eq("mc_status_updated", mc_status_updated)
            if product:
                query = query.eq("product", product)
        else:
            return None, None, None

        result = query.order("priority", desc=True).limit(1).execute()

        if result.data:
            row = result.data[0]
            sop_id = row["sop_id"]
            sop = supabase.table("sops").select(_SOP_COLS).eq("id", sop_id).limit(1).execute()
            if sop.data:
                print(f"[error_routing] matched sop_id={sop_id} action={row['action_type']} level={row['level']}", flush=True)
                return sop.data[0], row["action_type"], row["level"]
    except Exception as e:
        print(f"[error_routing] lookup failed: {e}", flush=True)
    return None, None, None


# --- Node 2: Knowledge Retrieval ---
# Priority: error_routing → semantic search → exact error code → keyword fallback
def retrieve_knowledge(state: ResolutionState) -> dict:
    ctx = state["extracted_context"] or {}
    error_code = ctx.get("errorCode")
    intent = ctx.get("intent", "")
    indicators = ctx.get("keyIndicators", [])
    domain = ctx.get("product", "")

    sops = []
    seen_ids: set = set()
    action_type: Optional[str] = None
    routing_level: Optional[int] = None

    def add_sops(new_sops: list) -> None:
        for s in new_sops:
            sid = str(s.get("id", ""))
            if sid and sid not in seen_ids:
                seen_ids.add(sid)
                sops.append(s)

    # Priority -1: Deterministic error_routing table lookup
    routing_sop, action_type, routing_level = _error_routing_lookup(
        bc_code=ctx.get("bc_code"),
        tpe_code=ctx.get("tpe_code"),
        step_result=ctx.get("step_result"),
        mc_status=ctx.get("mc_status"),
        mc_status_updated=ctx.get("mc_status_updated"),
        product=ctx.get("routingProduct"),
    )
    if routing_sop:
        add_sops([routing_sop])

    # Priority 0: Semantic search via pgvector — catches intent/synonym matches keyword can't
    add_sops(_semantic_search(intent))

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
        keywords = [w for w in (intent.split()[:3] + indicators[:2]) if len(w) > 2]
        for kw in keywords[:3]:
            for col in ("keywords_primary", "title"):
                result = supabase.table("sops").select(_SOP_COLS).eq(
                    "domain", domain
                ).ilike(col, f"%{kw}%").limit(5).execute()
                add_sops(result.data or [])
            if len(sops) >= 5:
                return {"retrieved_sops": sops[:5], "action_type": action_type, "routing_level": routing_level}

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

    return {"retrieved_sops": sops[:5], "action_type": action_type, "routing_level": routing_level}


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
_ACTION_TYPE_GUIDANCE = {
    "template_response": "Sử dụng template phản hồi chuẩn theo SOP. Không tự sáng tạo nội dung ngoài template.",
    "escalate_cs2":      "Cần leo thang lên CS2. Thông báo cho KH rằng case sẽ được xử lý bởi bộ phận chuyên sâu.",
    "pending_recheck":   "GD đang pending — cần recheck sau T+1 hoặc T+3 ngày làm việc. Hướng dẫn KH chờ và cung cấp thời hạn cụ thể.",
}

_TONE_LINES = {
    "binh_thuong": {
        "empathy": "Cảm ơn bạn đã liên hệ Zalopay.",
        "closing": "Cảm ơn bạn đã sử dụng dịch vụ Zalopay.",
    },
    "kho_chiu": {
        "empathy": "Cảm ơn bạn đã phản ánh, Zalopay hiểu đây là trải nghiệm chưa tốt với bạn.",
        "closing": "Zalopay mong bạn sẽ có trải nghiệm tốt hơn trong những lần tới.",
    },
    "gay_gat": {
        "empathy": "Zalopay thành thật xin lỗi vì sự bất tiện bạn đang gặp phải.",
        "closing": "Zalopay xin lỗi và mong bạn tiếp tục tin tưởng sử dụng dịch vụ.",
    },
    "de_doa": {
        "empathy": "Zalopay xin lỗi bạn về vấn đề này và cam kết hỗ trợ bạn đến khi giải quyết xong.",
        "closing": "Zalopay cam kết đồng hành cùng bạn trong suốt quá trình xử lý.",
    },
}


def generate_response(state: ResolutionState) -> dict:
    reasoning = state["reasoning"] or {}
    sop = state["selected_sop"] or {}
    ctx = state["extracted_context"] or {}
    action_type = state.get("action_type") or ""
    customer_tone = state.get("customerTone") or ctx.get("customerTone") or "binh_thuong"
    tone_config = _TONE_LINES.get(customer_tone, _TONE_LINES["binh_thuong"])

    # Ưu tiên resolution_summary (ngắn gọn cho AI), fallback sang solution_l1
    sop_solution = sop.get("resolution_summary", "") or sop.get("solution_l1", "")
    sop_detail = sop.get("solution_l2", "")
    sop_escalation = sop.get("escalation_criteria", "")
    sop_template = sop.get("template_app_mail", "") or ""

    action_guidance = ""
    if action_type and action_type in _ACTION_TYPE_GUIDANCE:
        action_guidance = f"\n- Routing Action: {action_type} — {_ACTION_TYPE_GUIDANCE[action_type]}"

    prompt = f"""You are a Customer Service Specialist at ZaloPay.

Ticket summary:
- Issue Type: {reasoning.get('issueType')}
- Root Cause: {reasoning.get('rootCause')}
- Recommended Actions: {json.dumps(reasoning.get('recommendedActions', []), ensure_ascii=False)}
- Needs Escalation: {reasoning.get('needEscalation')}
- SOP: {sop.get('title', 'N/A')}
- SOP Solution: {sop_solution}
- SOP Detail: {sop_detail}
- Escalation Criteria: {sop_escalation or 'Not specified'}{action_guidance}

Write three outputs in Vietnamese:

1. replyDraft — a professional, empathetic customer reply:
   - Acknowledge the issue
   - Explain the resolution or next step clearly
   - Be concise (3-5 sentences)
   - If escalation needed, tell customer you will follow up

2. internalNote — ghi chú nội bộ cho CS team. Phải tuân đúng format 3 section sau, mỗi section cách nhau bằng dòng trống, ngôn ngữ Tiếng Việt:

Mô tả vấn đề: [1-2 câu mô tả tình huống khách hàng gặp phải]

Nguyên nhân: [nguyên nhân kỹ thuật hoặc nghiệp vụ]

Hướng xử lý đề xuất: [các bước xử lý, mỗi bước trên 1 dòng, dùng dấu → để phân cách]

CRITICAL rules for internalNote:
- Do NOT include UserID, TransID, or any ticket metadata. The frontend already prepends these.
- internalNote MUST start directly with "Mô tả vấn đề:"
- Luôn có đủ 3 section theo đúng thứ tự trên
- Không viết thành 1 đoạn liền — mỗi section phải xuống dòng rõ ràng
- Không thêm section nào khác ngoài 3 section trên

3. templateAdapted — customer-facing template adapted for tone:
Customer tone: {customer_tone}
Base template from SOP (preserve solution content exactly): {sop_template or 'N/A'}

TONE ADAPTATION RULES:
1. First line is ALWAYS exactly "Chào bạn," — NEVER change this regardless of tone.
2. Empathy line (second line): "{tone_config['empathy']}"
3. Closing line (last line): "{tone_config['closing']}"
4. Solution content (middle section) is taken directly from the base template — do NOT modify it.
5. Output the complete template: "Chào bạn," + empathy line + solution content + closing line.
6. If base template is "N/A" or empty, output an empty string for templateAdapted.

Return ONLY a valid JSON object:
{{
  "replyDraft": "customer reply in Vietnamese here",
  "internalNote": "Mô tả vấn đề: ...\n\nNguyên nhân: ...\n\nHướng xử lý đề xuất: ...\n→ Bước 1\n→ Bước 2",
  "templateAdapted": "Chào bạn,\n{tone_config['empathy']}\n[solution content]\n{tone_config['closing']}"
}}"""

    response = llm.invoke([HumanMessage(content=prompt)])
    output = _parse_json(response.content)
    if not output:
        output = {
            "replyDraft": response.content,
            "internalNote": f"Mô tả vấn đề: {reasoning.get('rootCause')}.\n\nNguyên nhân: Không xác định được từ SOP.\n\nHướng xử lý đề xuất: → {'; → '.join(reasoning.get('recommendedActions', ['Escalate to CS2']))}",
            "templateAdapted": "",
        }

    return {
        "reply_draft": output.get("replyDraft", ""),
        "internal_note": output.get("internalNote", ""),
        "template_adapted": output.get("templateAdapted", ""),
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
    print("[debug] ticket_text:", repr(ticket_text[:120] if ticket_text else ticket_text), flush=True)
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
            "action_type": None,
            "routing_level": None,
            "customerTone": None,
            "template_adapted": None,
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
        "templateCallChat": result.get("template_adapted") or sop.get("template_app_mail", "") or "",
        "customerTone": (result.get("customerTone") or (result.get("extracted_context") or {}).get("customerTone") or "binh_thuong"),
        "timestamp": datetime.now().isoformat(),
    }


@app.ping
def health_check() -> PingStatus:
    return PingStatus.HEALTHY


if __name__ == "__main__":
    app.run(port=8080, host="0.0.0.0")
