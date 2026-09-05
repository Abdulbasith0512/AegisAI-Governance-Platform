import re
import logging
from typing import Dict, List, Any, Optional, Set, Tuple
from datetime import datetime

logger = logging.getLogger("aegisai.security_layer")

class AISecurityService:
    """
    Enterprise-grade AI Security Service for protecting LLMs and Agents from
    abuse, exploits, PII leakage, credential leaks, and rate-limit violations.
    """

    def __init__(self) -> None:
        # Common prompt injection patterns (regexes)
        self.injection_patterns = [
            re.compile(r"(?:ignore|bypass|override|forget)\s+(?:all|previous|system|instructions|rules)", re.IGNORECASE),
            re.compile(r"you\s+are\s+now\s+(?:unrestricted|free|no\s+longer\s+bound|jailbroken)", re.IGNORECASE),
            re.compile(r"translate\s+the\s+following\s+system\s+prompt", re.IGNORECASE),
            re.compile(r"output\s+the\s+system\s+(?:instructions|prompt|directives)", re.IGNORECASE),
            re.compile(r"assistant\s+mode\s+disabled", re.IGNORECASE),
            re.compile(r"\[system\s+override\]", re.IGNORECASE),
        ]

        # Common PII detection regexes
        self.pii_patterns = {
            "email": re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
            "phone": re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
            "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
            "credit_card": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
        }

        # Common secret/credential detection regexes
        self.secret_patterns = {
            "aws_access_key": re.compile(r"\b(AKIA|ASCA|ASIA)[A-Z0-9]{16}\b"),
            "jwt_token": re.compile(r"\beyJhbGciOi[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b"),
            "ssh_private_key": re.compile(r"-----BEGIN\s+([A-Z0-9\s_]+)\s+PRIVATE\s+KEY-----"),
            "generic_api_key": re.compile(r"\b(?:api_key|apikey|secret_key|secretkey|sk_live|sk_test)_[a-zA-Z0-9]{24,40}\b", re.IGNORECASE),
        }

        # Jailbreak behavioral keywords
        self.jailbreak_keywords = [
            "dan", "do anything now", "developer mode v2", "jailbreak", "unfiltered",
            "unrestricted", "evil assistant", "opposite mode", "hypothetical scenario where you can"
        ]

        # Threat Intelligence (in-memory database of blocked entities/threat logs)
        self.threat_logs: List[Dict[str, Any]] = []
        self.blocked_ips: Set[str] = set()
        
        # Default firewall rules config
        self.config = {
            "prompt_injection_enabled": True,
            "pii_detection_enabled": True,
            "secret_detection_enabled": True,
            "jailbreak_detection_enabled": True,
            "input_validation_enabled": True,
            "output_validation_enabled": True,
            "max_prompt_length": 4096,
        }

    def update_config(self, new_config: Dict[str, Any]) -> None:
        """
        Dynamically updates firewall protection rules config.
        """
        self.config.update(new_config)
        logger.info(f"AI Security Firewall configuration updated: {self.config}")

    def log_threat(self, match_type: str, actor_ip: str, payload_preview: str, severity: str) -> None:
        """
        Appends a threat log to the internal security audit ledger.
        """
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "match_type": match_type,
            "actor_ip": actor_ip,
            "payload_preview": payload_preview[:120] + ("..." if len(payload_preview) > 120 else ""),
            "severity": severity
        }
        self.threat_logs.insert(0, log_entry)
        if len(self.threat_logs) > 500:
            self.threat_logs.pop()

    def check_luhn(self, cc_number: str) -> bool:
        """
        Validates credit card checksum check via Luhn Algorithm.
        """
        digits = [int(c) for c in re.sub(r"\D", "", cc_number)]
        if not digits:
            return False
        checksum = 0
        reverse_digits = digits[::-1]
        for i, digit in enumerate(reverse_digits):
            if i % 2 == 1:
                digit *= 2
                if digit > 9:
                    digit -= 9
            checksum += digit
        return checksum % 10 == 0

    def scan_prompt(self, prompt: str, actor_ip: str = "127.0.0.1") -> Tuple[bool, List[str], Optional[str]]:
        """
        Scans a prompt input against configured prompt injections, jailbreaks, PII leakage,
        and high-entropy secrets. Returns: (is_blocked, rules_fired, sanitized_prompt)
        """
        rules_fired: List[str] = []
        sanitized = prompt

        # 1. Input validation (Size limit check)
        if self.config["input_validation_enabled"]:
            if len(prompt) > self.config["max_prompt_length"]:
                rules_fired.append("Input limit exceeded")
                self.log_threat("input_validation", actor_ip, prompt, "low")
                return True, rules_fired, None

        # 2. Prompt Injection scanner
        if self.config["prompt_injection_enabled"]:
            for pattern in self.injection_patterns:
                if pattern.search(prompt):
                    rules_fired.append("Prompt Injection")
                    self.log_threat("prompt_injection", actor_ip, prompt, "critical")
                    return True, rules_fired, None

        # 3. Jailbreak behavioral scanner
        if self.config["jailbreak_detection_enabled"]:
            lowered = prompt.lower()
            if any(kw in lowered for kw in self.jailbreak_keywords):
                rules_fired.append("Jailbreak Attempt")
                self.log_threat("jailbreak", actor_ip, prompt, "high")
                return True, rules_fired, None

        # 4. PII Leakage scanner
        if self.config["pii_detection_enabled"]:
            for name, pattern in self.pii_patterns.items():
                matches = pattern.findall(prompt)
                if matches:
                    if name == "credit_card":
                        # Validate CC checksum
                        cc_matches = [m for m in matches if self.check_luhn(m)]
                        if not cc_matches:
                            continue
                    rules_fired.append(f"PII Leakage: {name.upper()}")
                    self.log_threat("pii_leak", actor_ip, prompt, "medium")
                    # Redact PII in sanitized output
                    sanitized = pattern.sub(f"[{name.upper()}_REDACTED]", sanitized)

        # 5. Secrets scanner
        if self.config["secret_detection_enabled"]:
            for name, pattern in self.secret_patterns.items():
                if pattern.search(prompt):
                    rules_fired.append(f"Credential Leak: {name.upper()}")
                    self.log_threat("secret_leak", actor_ip, prompt, "high")
                    return True, rules_fired, None

        return len(rules_fired) > 0 and self.config["pii_detection_enabled"] is False, rules_fired, sanitized

    def scan_output(self, response_text: str, actor_ip: str = "127.0.0.1") -> Tuple[bool, List[str], str]:
        """
        Validates outbound model completions against secret leaks and compliance regulations.
        """
        rules_fired: List[str] = []
        sanitized = response_text

        if not self.config["output_validation_enabled"]:
            return False, [], response_text

        # Scan output for PII leakage (Redact rather than block for output)
        if self.config["pii_detection_enabled"]:
            for name, pattern in self.pii_patterns.items():
                matches = pattern.findall(response_text)
                if matches:
                    if name == "credit_card" and not any(self.check_luhn(m) for m in matches):
                        continue
                    rules_fired.append(f"Outbound PII: {name.upper()}")
                    sanitized = pattern.sub(f"[{name.upper()}_REDACTED]", sanitized)

        # Scan output for Secrets leakage (Block completely if sensitive keys leak)
        if self.config["secret_detection_enabled"]:
            for name, pattern in self.secret_patterns.items():
                if pattern.search(response_text):
                    rules_fired.append(f"Outbound Secret Leak: {name.upper()}")
                    self.log_threat("outbound_leak", actor_ip, response_text, "critical")
                    return True, rules_fired, ""

        return False, rules_fired, sanitized

# Global security service singleton
security_service = AISecurityService()
