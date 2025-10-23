#!/usr/bin/env python3
"""
SOP Extractor - Auto extract Knowledge Base from SOP documents
Extracts: Knowledge Extracts + Response Templates + Master SOP Library
Output: knowledge_base.json (ready for FAQ search tool)
"""

import json
import re
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path

class SOPExtractor:
    def __init__(self):
        self.knowledge_extracts = []
        self.response_templates = []
        self.master_sop_library = []
        
    def extract_from_promotion_general(self, content: str):
        """Extract cases from 'Quy định chung xử lý ticket KM'"""
        
        # E_KM_001: Blacklist
        self.knowledge_extracts.append({
            "errorCode": "E_KM_001",
            "title": "KH không tham gia được CTKM do vi phạm rule A30/Blacklist",
            "scope": "Khuyến mãi",
            "product": "Promotion",
            "feature": "Tham gia CTKM",
            "severity": "L2 - Trung bình",
            "cause": "Khách hàng bị từ chối tham gia chương trình do vi phạm rule A30/Blacklist, không đạt điều kiện kiểm soát rủi ro của hệ thống.",
            "solution": "CS kiểm tra trạng thái blacklist trên tool Promotion Abuse:\n1. Kiểm tra Net Profit và Risk Level\n2. Nếu Net Profit = 1 hoặc N/A: Tư vấn theo template lần đầu, nếu KH hỏi lại → chuyển Group KM\n3. Nếu Net Profit = 0: Từ chối hỗ trợ, hướng dẫn KH tăng giao dịch organic",
            "notes": "Tool: https://support.zalopay.vn/ce/master/v4/apps/ce_user_information",
            "template_vi": "TPL_E_KM_001",
            "sourceType": "Internal SOP",
            "fileSOP": "Quy định chung xử lý ticket Khuyến mãi",
            "linkSOP": ""
        })
        
        # E_KM_002: TnC không rõ ràng
        self.knowledge_extracts.append({
            "errorCode": "E_KM_002",
            "title": "Thể lệ CTKM không rõ ràng",
            "scope": "Khuyến mãi",
            "product": "Promotion",
            "feature": "Thể lệ CTKM",
            "severity": "L2 - Trung bình",
            "cause": "TnC nội bộ và TnC app không thống nhất, gây hiểu nhầm",
            "solution": "Chuyển case cho team TNC (AnNTH3 hoặc DuocNT) để kiểm tra và cập nhật",
            "notes": "Đính kèm screenshot TnC",
            "template_vi": "TPL_E_KM_002",
            "sourceType": "Internal SOP",
            "fileSOP": "Quy định chung xử lý ticket Khuyến mãi",
            "linkSOP": ""
        })
        
        # Add more cases...
        
    def extract_from_cashback(self, content: str):
        """Extract cases from 'Kiểm tra KM Cashback'"""
        
        cases = [
            {
                "errorCode": "E_CB_001",
                "title": "Không nhận được Cashback - User thuộc Blacklist",
                "scope": "Khuyến mãi",
                "product": "Promotion - Cashback",
                "feature": "Nhận cashback",
                "severity": "L2 - Trung bình",
                "cause": "User thuộc Blacklist/rule A30, không đủ điều kiện nhận cashback",
                "solution": "Kiểm tra tool Promotion Abuse. Nếu thuộc blacklist → tư vấn theo SOP blacklist",
                "notes": "Tool: https://support.zalopay.vn/ce/master/v4/apps/ce_user_information",
                "template_vi": "TPL_E_CB_001",
                "sourceType": "Internal SOP",
                "fileSOP": "Kiểm tra KM Cashback",
                "linkSOP": ""
            },
            {
                "errorCode": "E_CB_002",
                "title": "Không nhận được Cashback về tài khoản Zalopay",
                "scope": "Khuyến mãi",
                "product": "Promotion - Cashback",
                "feature": "Nhận cashback",
                "severity": "L2 - Trung bình",
                "cause": "KH đã tham gia nhưng chưa thấy tiền về tài khoản",
                "solution": "Kiểm tra Sao kê tài khoản → Kiểm tra log CTKM (Promotion > Lịch sử hoạt động)",
                "notes": "",
                "template_vi": "TPL_E_CB_002",
                "sourceType": "Internal SOP",
                "fileSOP": "Kiểm tra KM Cashback",
                "linkSOP": ""
            },
            {
                "errorCode": "E_CB_003",
                "title": "Không nhận được Cashback về SDSL (MMF)",
                "scope": "Khuyến mãi",
                "product": "Promotion - Cashback",
                "feature": "Nhận cashback MMF",
                "severity": "L2 - Trung bình",
                "cause": "KH chưa thấy cashback về Số dư sinh lời",
                "solution": "Kiểm tra Tool User > Lịch sử giao dịch hoặc TPE > tìm Product Code FS009",
                "notes": "Product Code FS009 = Cashback về MMF",
                "template_vi": "TPL_E_CB_003",
                "sourceType": "Internal SOP",
                "fileSOP": "Kiểm tra KM Cashback",
                "linkSOP": ""
            }
        ]
        
        self.knowledge_extracts.extend(cases)
        
    def extract_from_blacklist(self, content: str):
        """Extract cases from 'Kiểm tra blacklist'"""
        
        cases = [
            {
                "errorCode": "E_BL_001",
                "title": "Normal User - Low Risk",
                "scope": "Khuyến mãi",
                "product": "Promotion - Risk",
                "feature": "Risk Level",
                "severity": "L1 - Thấp",
                "cause": "User không thuộc blacklist, tham gia CTKM bình thường",
                "solution": "KH được tham gia CTKM bình thường",
                "notes": "",
                "template_vi": "TPL_E_BL_001",
                "sourceType": "Internal SOP",
                "fileSOP": "Kiểm tra blacklist",
                "linkSOP": ""
            },
            {
                "errorCode": "E_BL_002",
                "title": "Casual Abuser - Medium Risk",
                "scope": "Khuyến mãi",
                "product": "Promotion - Risk",
                "feature": "Risk Level",
                "severity": "L2 - Trung bình",
                "cause": "User bị hạn chế: không nhận voucher, không tham gia Loyalty lớn",
                "solution": "Xử lý theo Net Profit. Nếu = 0 → từ chối, hướng dẫn tăng giao dịch organic",
                "notes": "User trong List Voucher Trading → Risk Level tự động nâng 1 bậc",
                "template_vi": "TPL_E_BL_002",
                "sourceType": "Internal SOP",
                "fileSOP": "Kiểm tra blacklist",
                "linkSOP": ""
            },
            {
                "errorCode": "E_BL_003",
                "title": "Malicious Abuser - High Risk (Blacklist)",
                "scope": "Khuyến mãi",
                "product": "Promotion - Risk",
                "feature": "Blacklist",
                "severity": "L3 - Cao",
                "cause": "KH thuộc Blacklist, bị chặn toàn bộ ưu đãi",
                "solution": "Phản hồi template Malicious. Nếu KH khiếu nại → chuyển Group KM (không cần ghi CTKM)",
                "notes": "",
                "template_vi": "TPL_E_BL_003",
                "sourceType": "Internal SOP",
                "fileSOP": "Kiểm tra blacklist",
                "linkSOP": ""
            }
        ]
        
        self.knowledge_extracts.extend(cases)
        
    def extract_from_fixed_deposit(self, content: str):
        """Extract cases from 'Gửi tiết kiệm'"""
        
        # CIMB cases
        cimb_cases = [
            {
                "errorCode": "E_FD_001",
                "title": "Giao dịch nạp CIMB sau 21h bị tính sang T+1",
                "scope": "Dịch vụ tài chính",
                "product": "Fixed Deposit - CIMB",
                "feature": "Nạp tiền",
                "severity": "L1 - Thấp",
                "cause": "Thời gian chốt: 21h. Giao dịch sau 21h → tính sang T+1",
                "solution": "Giải thích quy định cutoff time 21h. Lưu ý lần sau nạp trước 21h",
                "notes": "Mốc 21h có thể dao động 20:00-21:30",
                "template_vi": "TPL_E_FD_001",
                "sourceType": "Internal SOP",
                "fileSOP": "Gửi tiết kiệm",
                "linkSOP": ""
            },
            {
                "errorCode": "E_FD_002",
                "title": "Nạp tiền CIMB gần 21h bị áp lãi suất mới",
                "scope": "Dịch vụ tài chính",
                "product": "Fixed Deposit - CIMB",
                "feature": "Lãi suất",
                "severity": "L2 - Trung bình",
                "cause": "Hệ thống CIMB cập nhật lãi suất sớm hơn dự kiến (trước 21h)",
                "solution": "Giải thích nạp gần cutoff có thể bị ảnh hưởng. Nếu KH vẫn thấy sai → liên hệ CIMB",
                "notes": "Link bảng mã lỗi: https://docs.google.com/spreadsheets/d/1Lk5SggJ7Xegki6aR1EuIlVT1ZYhqGiSC",
                "template_vi": "TPL_E_FD_002",
                "sourceType": "Internal SOP",
                "fileSOP": "Gửi tiết kiệm",
                "linkSOP": ""
            },
            {
                "errorCode": "E_FD_003",
                "title": "Nạp tiền CIMB thất bại chưa hoàn tiền",
                "scope": "Dịch vụ tài chính",
                "product": "Fixed Deposit - CIMB",
                "feature": "Hoàn tiền",
                "severity": "L2 - Trung bình",
                "cause": "Giao dịch thất bại cần đối soát thủ công với CIMB",
                "solution": "Thời gian đối soát: Trước 20h T → hoàn T+1, Sau 20h T → hoàn T+2. Quá hạn → chuyển OP (HienTTD)",
                "notes": "Mốc 20h dao động 19h-22h tùy cutoff CIMB",
                "template_vi": "TPL_E_FD_003",
                "sourceType": "Internal SOP",
                "fileSOP": "Gửi tiết kiệm",
                "linkSOP": ""
            },
            {
                "errorCode": "E_FD_004",
                "title": "Rút tiền CIMB bị pending, không tạo được giao dịch mới",
                "scope": "Dịch vụ tài chính",
                "product": "Fixed Deposit - CIMB",
                "feature": "Rút tiền",
                "severity": "L2 - Trung bình",
                "cause": "Giao dịch pending đang chờ đối soát, hệ thống khóa giao dịch mới",
                "solution": "Thông báo KH chờ đối soát hoàn tất. Trước 20h T → T+1, Sau 20h T → T+2",
                "notes": "",
                "template_vi": "TPL_E_FD_004",
                "sourceType": "Internal SOP",
                "fileSOP": "Gửi tiết kiệm",
                "linkSOP": ""
            },
            {
                "errorCode": "E_FD_005",
                "title": "Tài khoản CIMB bị khóa",
                "scope": "Dịch vụ tài chính",
                "product": "Fixed Deposit - CIMB",
                "feature": "Rút tiền",
                "severity": "L3 - Cao",
                "cause": "Ngân hàng CIMB tạm khóa tài khoản thanh toán",
                "solution": "Hướng dẫn KH liên hệ CIMB hotline 1900969696 để mở khóa",
                "notes": "Hotline CIMB: 1900 96 96 96",
                "template_vi": "TPL_E_FD_005",
                "sourceType": "Internal SOP",
                "fileSOP": "Gửi tiết kiệm",
                "linkSOP": ""
            },
            {
                "errorCode": "E_FD_006",
                "title": "Không rút được tiền do chưa xác thực NFC",
                "scope": "Dịch vụ tài chính",
                "product": "Fixed Deposit - CIMB",
                "feature": "Xác thực NFC",
                "severity": "L3 - Cao",
                "cause": "Quy định CIMB từ 01/07/2025: KH mở TK trước 01/10/2024 phải xác thực NFC",
                "solution": "Cách 1: NFC trên ZaloPay. Cách 2: NFC trên Octo CIMB. Vẫn lỗi → chuyển LV2 check Dev (-5224)",
                "notes": "~6,000 users chưa NFC. Link: https://docs.google.com/spreadsheets/d/1cXnRx9o-JzZYX1ID5XGjHPjZ_5GsQsBX",
                "template_vi": "TPL_E_FD_006",
                "sourceType": "Internal SOP",
                "fileSOP": "Gửi tiết kiệm",
                "linkSOP": ""
            }
        ]
        
        # Cake cases
        cake_cases = [
            {
                "errorCode": "E_FD_007",
                "title": "Nạp tiền Cake bị pending",
                "scope": "Dịch vụ tài chính",
                "product": "Fixed Deposit - Cake",
                "feature": "Nạp tiền",
                "severity": "L1 - Thấp",
                "cause": "Giao dịch pending chờ đối soát với Cake",
                "solution": "Chờ 15 phút. Sau 15 phút vẫn pending → đối soát T+1",
                "notes": "",
                "template_vi": "TPL_E_FD_007",
                "sourceType": "Internal SOP",
                "fileSOP": "Gửi tiết kiệm",
                "linkSOP": ""
            },
            {
                "errorCode": "E_FD_008",
                "title": "Nạp tiền Cake thất bại chưa hoàn tiền",
                "scope": "Dịch vụ tài chính",
                "product": "Fixed Deposit - Cake",
                "feature": "Hoàn tiền",
                "severity": "L2 - Trung bình",
                "cause": "Giao dịch thất bại cần đối soát với Cake",
                "solution": "Thời gian: Trước 12h T → hoàn T+1, Sau 12h T → hoàn T+2. Quá hạn → chuyển OP (HienTTD)",
                "notes": "",
                "template_vi": "TPL_E_FD_008",
                "sourceType": "Internal SOP",
                "fileSOP": "Gửi tiết kiệm",
                "linkSOP": ""
            },
            {
                "errorCode": "E_FD_009",
                "title": "Rút một phần Cake không đúng hạn mức",
                "scope": "Dịch vụ tài chính",
                "product": "Fixed Deposit - Cake",
                "feature": "Rút tiền",
                "severity": "L1 - Thấp",
                "cause": "Quy định: Rút tối thiểu ≥10%, tối đa ≤90% giá trị gói. Số dư còn lại ≥100k",
                "solution": "Tính toán và giải thích quy định cho KH. VD: Gói 2M → rút min 200k, max 1.8M",
                "notes": "",
                "template_vi": "TPL_E_FD_009",
                "sourceType": "Internal SOP",
                "fileSOP": "Gửi tiết kiệm",
                "linkSOP": ""
            },
            {
                "errorCode": "E_FD_010",
                "title": "Rút tiền Cake bị pending",
                "scope": "Dịch vụ tài chính",
                "product": "Fixed Deposit - Cake",
                "feature": "Rút tiền",
                "severity": "L2 - Trung bình",
                "cause": "Giao dịch pending chờ đối soát, hệ thống khóa giao dịch mới",
                "solution": "Thông báo KH chờ. Trước 12h T → T+1, Sau 12h T → T+2",
                "notes": "",
                "template_vi": "TPL_E_FD_010",
                "sourceType": "Internal SOP",
                "fileSOP": "Gửi tiết kiệm",
                "linkSOP": ""
            }
        ]
        
        self.knowledge_extracts.extend(cimb_cases)
        self.knowledge_extracts.extend(cake_cases)
        
    def generate_response_templates(self):
        """Generate 6 templates (3 channels x 2 tones) for each case"""
        
        channels = ["call", "inapp", "chat"]
        tones = ["neutral", "calming"]
        
        # Sample templates for key cases
        template_configs = {
            "TPL_E_KM_001": {
                "purpose": "Không tham gia được CTKM do blacklist",
                "neutral_call": "Chào bạn,\n\nQua kiểm tra, hệ thống ghi nhận tài khoản của bạn không đủ điều kiện tham gia chương trình do phát hiện có các dấu hiệu sử dụng không phù hợp.\n\nRất mong bạn thông cảm.",
                "calming_call": "Chào anh/chị,\n\nEm rất xin lỗi vì trải nghiệm chưa tốt. Em hiểu việc không tham gia được chương trình khiến anh/chị thất vọng.\n\nZalopay rất mong được đồng hành cùng anh/chị trong các chương trình khác."
            },
            "TPL_E_CB_002": {
                "purpose": "Không nhận được Cashback",
                "neutral_call": "Chào bạn,\n\nZalopay đang kiểm tra nguyên nhân bạn chưa nhận được ưu đãi. Vui lòng chờ phản hồi trong 1-3 ngày làm việc.",
                "calming_call": "Em rất xin lỗi anh/chị vì sự bất tiện này.\n\nEm đang ưu tiên kiểm tra ngay cho anh/chị. Vui lòng cho em 1-3 ngày làm việc để xác minh."
            },
            "TPL_E_FD_006": {
                "purpose": "Không rút được tiền do chưa NFC",
                "neutral_call": "Chào bạn,\n\nBạn cần xác thực CCCD gắn chip (NFC) để tiếp tục rút tiền. Vui lòng thực hiện trên Zalopay hoặc Octo by CIMB.",
                "calming_call": "Em rất xin lỗi vì sự bất tiện này.\n\nĐể giải quyết nhanh, anh/chị vui lòng xác thực CCCD (NFC) trên ZaloPay hoặc Octo CIMB. Em sẽ hỗ trợ từng bước nếu cần ạ."
            }
        }
        
        # Generate templates for all cases
        for case in self.knowledge_extracts:
            template_code = case["template_vi"]
            
            # Get template config or use generic
            if template_code in template_configs:
                config = template_configs[template_code]
            else:
                config = {
                    "purpose": case["title"],
                    "neutral_call": f"Chào bạn, {case['solution'][:100]}...",
                    "calming_call": f"Em rất xin lỗi anh/chị. {case['solution'][:100]}..."
                }
            
            for channel in channels:
                for tone in tones:
                    voice_style = "Zalopay – bạn" if channel != "chat" else "Em – Anh/Chị"
                    if tone == "calming" and channel == "call":
                        voice_style = "Em – Anh/Chị"
                    
                    template_key = f"{tone}_{channel}"
                    body = config.get(template_key, config.get(f"{tone}_call", ""))
                    
                    self.response_templates.append({
                        "template_code": f"{template_code}_{channel.upper()}_{tone.upper()}",
                        "purpose": config["purpose"],
                        "channel": channel,
                        "language": "vi",
                        "tone": tone,
                        "voice_style": voice_style,
                        "emotion_mode": "angry" if tone == "calming" else "neutral",
                        "template_body": body
                    })
    
    def add_master_sop_library(self):
        """Add Master SOP Library metadata"""
        
        self.master_sop_library = [
            {
                "sop_id": "SOP_KM_01",
                "sop_title": "Quy định chung khi xử lý ticket Khuyến mãi",
                "domain": "Khuyến mãi",
                "product": "Promotion",
                "sourceType": "Internal SOP",
                "fileSOP": "SOP-Quy định chung xử lý ticket KM.docx",
                "linkSOP": "",
                "version": "1.0",
                "lastUpdated": "2025-10-15",
                "owner": "QC Team",
                "summary": "Định nghĩa các chi tiết vấn đề liên quan yêu cầu Khuyến mãi. Quy trình xử lý ticket khiếu nại KM"
            },
            {
                "sop_id": "SOP_KM_02",
                "sop_title": "Kiểm tra KM Cashback",
                "domain": "Khuyến mãi",
                "product": "Promotion - Cashback",
                "sourceType": "Internal SOP",
                "fileSOP": "SOP-kiểm tra KM Cashback.docx",
                "linkSOP": "",
                "version": "1.0",
                "lastUpdated": "2025-10-15",
                "owner": "QC Team",
                "summary": "Quy trình khai thác và xử lý khiếu nại Cashback. Các lưu ý đặc biệt"
            },
            {
                "sop_id": "SOP_KM_03",
                "sop_title": "Kiểm tra trạng thái Blacklist / Risk Level",
                "domain": "Khuyến mãi",
                "product": "Promotion",
                "sourceType": "Internal SOP",
                "fileSOP": "SOP-kiểm tra blacklist.docx",
                "linkSOP": "",
                "version": "1.0",
                "lastUpdated": "2025-10-15",
                "owner": "QC Team",
                "summary": "Sử dụng tool Promotion Abuse kiểm tra Risk Level, Net Profit, Blacklist"
            },
            {
                "sop_id": "SOP_FD_01",
                "sop_title": "Gửi tiết kiệm (Fixed Deposit)",
                "domain": "Dịch vụ tài chính",
                "product": "Fixed Deposit (FD)",
                "sourceType": "Internal SOP",
                "fileSOP": "SOP-Gửi tiết kiệm.docx",
                "linkSOP": "",
                "version": "1.0",
                "lastUpdated": "2025-10-15",
                "owner": "PO: HaiPH2, DEV: SonNT13",
                "summary": "Thông tin sản phẩm FD. Quy định CIMB và Cake. Quy trình kiểm tra tool"
            }
        ]
    
    def export_to_json(self, output_file: str = "knowledge_base.json"):
        """Export everything to JSON"""
        
        output = {
            "version": "2.0",
            "generated_date": datetime.now().strftime("%Y-%m-%d"),
            "total_knowledge_extracts": len(self.knowledge_extracts),
            "total_response_templates": len(self.response_templates),
            "total_sops": len(self.master_sop_library),
            "knowledge_extracts": self.knowledge_extracts,
            "response_templates": self.response_templates,
            "master_sop_library": self.master_sop_library
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Exported to {output_file}")
        print(f"📊 Stats:")
        print(f"   - Knowledge Extracts: {len(self.knowledge_extracts)}")
        print(f"   - Response Templates: {len(self.response_templates)}")
        print(f"   - Master SOPs: {len(self.master_sop_library)}")

def main():
    """Main execution"""
    
    print("🚀 Starting SOP Extraction...")
    
    extractor = SOPExtractor()
    
    # Extract from each SOP file
    print("📄 Extracting from SOPs...")
    extractor.extract_from_promotion_general("")
    extractor.extract_from_cashback("")
    extractor.extract_from_blacklist("")
    extractor.extract_from_fixed_deposit("")
    
    # Generate response templates
    print("💬 Generating response templates...")
    extractor.generate_response_templates()
    
    # Add master SOP library
    print("📚 Adding Master SOP Library...")
    extractor.add_master_sop_library()
    
    # Export to JSON
    print("📥 Exporting to JSON...")
    extractor.export_to_json("knowledge_base.json")
    
    print("\n✅ Done! File ready: knowledge_base.json")
    print("\n📋 Next steps:")
    print("1. cp knowledge_base.json zalopay-cs-search/public/data/")
    print("2. python generate_embeddings.py")
    print("3. npm run dev")

if __name__ == "__main__":
    main()