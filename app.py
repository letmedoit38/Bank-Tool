from flask import Flask, render_template, request, jsonify
import requests
import json

app = Flask(__name__)

GST_SEARCH_URL = "https://services.gst.gov.in/services/api/search/taxpayerSearch"
GST_DETAIL_URL = "https://services.gst.gov.in/services/api/search/taxpayerDetails"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json;charset=UTF-8",
    "Origin": "https://services.gst.gov.in",
    "Referer": "https://services.gst.gov.in/services/searchtp",
}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/company/<gstin>")
def company(gstin):
    return render_template("company.html", gstin=gstin)


@app.route("/api/search", methods=["POST"])
def search():
    data = request.get_json()
    pincode = data.get("pincode", "").strip()
    if not pincode or len(pincode) != 6 or not pincode.isdigit():
        return jsonify({"error": "Please enter a valid 6-digit pincode"}), 400

    payload = {
        "gstin": "",
        "tradeName": "",
        "pinCode": pincode,
        "stateCode": "",
        "legalName": "",
        "taxPayerType": "",
        "typeCode": 2
    }

    try:
        resp = requests.post(GST_SEARCH_URL, json=payload, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            result = resp.json()
            taxpayers = result.get("taxpayerSearchDTOList", [])
            firms = []
            for tp in taxpayers:
                firms.append({
                    "gstin": tp.get("gstin", ""),
                    "legalName": tp.get("legalName", ""),
                    "tradeName": tp.get("tradeName", "") or tp.get("legalName", ""),
                    "status": tp.get("sts", ""),
                    "type": tp.get("dty", ""),
                    "state": tp.get("stj", ""),
                    "pincode": pincode
                })
            return jsonify({"firms": firms, "count": len(firms)})
        else:
            return jsonify({"error": f"GST Portal returned status {resp.status_code}. Try again later."}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "GST Portal is slow. Please try again."}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/company/<gstin>")
def company_detail(gstin):
    if not gstin or len(gstin) != 15:
        return jsonify({"error": "Invalid GSTIN"}), 400

    payload = {"gstin": gstin}
    try:
        resp = requests.post(GST_DETAIL_URL, json=payload, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            tp = data.get("taxpayerDetails", data)

            # Build address
            addr_parts = []
            for key in ["bno", "flno", "st", "loc", "dst", "stcd", "pncd"]:
                val = tp.get(key, "")
                if val:
                    addr_parts.append(str(val))
            address = ", ".join(addr_parts) if addr_parts else ""

            # Filing returns info
            returns = tp.get("eFiling", []) or tp.get("filingStatus", [])

            result = {
                "gstin": tp.get("gstin", gstin),
                "legalName": tp.get("lgnm", "") or tp.get("legalName", ""),
                "tradeName": tp.get("tradeNam", "") or tp.get("tradeName", ""),
                "status": tp.get("sts", "") or tp.get("status", ""),
                "type": tp.get("dty", "") or tp.get("type", ""),
                "registrationDate": tp.get("rgdt", ""),
                "cancelDate": tp.get("cxdt", ""),
                "stateJurisdiction": tp.get("stj", ""),
                "centralJurisdiction": tp.get("ctj", ""),
                "constitutionOfBusiness": tp.get("ctb", ""),
                "address": address,
                "pincode": tp.get("pncd", ""),
                "phone": tp.get("pmob", "") or tp.get("phone", ""),
                "email": tp.get("email", ""),
                "returns": returns,
                "nob": tp.get("nob", []),
                "pradr": tp.get("pradr", {}),
                "raw": tp
            }

            # Try to extract phone/email from pradr if not found
            pradr = tp.get("pradr", {})
            if isinstance(pradr, dict):
                addr_obj = pradr.get("addr", {})
                if isinstance(addr_obj, dict):
                    result["phone"] = result["phone"] or addr_obj.get("mob", "") or ""
                    result["email"] = result["email"] or addr_obj.get("em", "") or ""
                    if not address:
                        addr_parts2 = []
                        for k in ["bno", "flno", "st", "loc", "dst", "stcd", "pncd"]:
                            v = addr_obj.get(k, "")
                            if v:
                                addr_parts2.append(str(v))
                        result["address"] = ", ".join(addr_parts2)
                        result["pincode"] = addr_obj.get("pncd", result["pincode"])

            return jsonify(result)
        else:
            return jsonify({"error": f"GST Portal returned {resp.status_code}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
