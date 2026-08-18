"""
EMAIL NAME EXTRACTION ENGINE  (v2)
====================================
A multi-stage pipeline that infers the most probable human name from an
email address, or from a raw pasted blob containing one or more email
addresses. Built as a "team" of specialist components, each owning one
narrow decision, coordinated by a lead orchestrator.

GUARANTEE: every call to run() or run_batch() returns a usable name.
If no email is found, the email is invalid, it belongs to a role account
(info@, noreply@, hr@...), or no name can be resolved from it, the engine
falls back to full_name = "Hiring Manager" rather than returning None or
raising an exception. Nothing is ever left blank.

Team roster:
  1. RawTextEmailFinder   - pulls email addresses out of any pasted text
  2. Sanitizer            - validates and normalizes a single email
  3. RoleAccountDetector  - flags non-human mailboxes
  4. TokenSplitter        - breaks the local-part into candidate tokens
                            (splits on separators AND embedded digits)
  5. NameSegmenter        - dictionary-driven word-split for fused tokens
  6. PatternClassifier    - identifies the naming convention in play,
                            cross-checks against both first-name AND
                            surname dictionaries, handles 1/2/3+ tokens
  7. Capitalizer          - proper-cases names, respects name particles
  8. ConfidenceScorer     - scores the final guess and explains why
  9. FallbackGuard        - the safety net: guarantees a name is always
                            returned, defaulting to "Hiring Manager"
  10. ExtractionPipeline  - the lead: runs the team in order, per email

Usage:
    from email_name_extractor import ExtractionPipeline

    pipeline = ExtractionPipeline()

    # Single, known-clean email
    result = pipeline.run("jane.doe@company.com")
    print(result.full_name, result.confidence)

    # Anything pasted in — one email, many emails, or a messy blob
    for r in pipeline.run_from_text(pasted_text):
        print(r.email, "->", r.full_name)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional, Set, Tuple


# ---------------------------------------------------------------------------
# Shared reference data
# ---------------------------------------------------------------------------

class ReferenceData:
    """Central dictionaries used by multiple team members."""

    FALLBACK_NAME = "Hiring Manager"

    ROLE_TOKENS: Set[str] = {
        "info", "support", "contact", "admin", "administrator", "sales",
        "hr", "billing", "help", "helpdesk", "noreply", "no-reply",
        "donotreply", "webmaster", "office", "team", "hello", "hi",
        "service", "services", "accounts", "careers", "jobs", "press",
        "media", "marketing", "newsletter", "notifications", "alerts",
        "orders", "order", "customerservice", "customercare", "feedback",
        "legal", "compliance", "security", "abuse", "postmaster", "root",
        "mail", "email", "enquiries", "inquiries", "general", "reception",
        "recruitment", "recruiting", "talent", "talentacquisition", "apply",
        "applications", "resumes", "jobsboard", "people", "peopleteam",
    }

    FIRST_NAMES: Set[str] = {
        "james", "john", "robert", "michael", "william", "david", "richard",
        "joseph", "thomas", "charles", "christopher", "daniel", "matthew",
        "anthony", "mark", "donald", "steven", "andrew", "joshua", "kevin",
        "brian", "george", "edward", "ronald", "timothy", "jason", "jeffrey",
        "ryan", "jacob", "gary", "nicholas", "eric", "jonathan", "stephen",
        "larry", "justin", "scott", "brandon", "benjamin", "samuel", "gregory",
        "frank", "raymond", "alexander", "patrick", "jack", "dennis", "jerry",
        "tyler", "aaron", "jose", "adam", "nathan", "henry", "zachary", "kyle",
        "walter", "harold", "carl", "arthur", "sean", "ethan", "austin",
        "mary", "patricia", "jennifer", "linda", "elizabeth", "barbara",
        "susan", "jessica", "sarah", "karen", "nancy", "lisa", "margaret",
        "betty", "sandra", "ashley", "dorothy", "kimberly", "emily", "donna",
        "michelle", "carol", "amanda", "melissa", "deborah", "stephanie",
        "rebecca", "sharon", "laura", "cynthia", "kathleen", "amy", "shirley",
        "angela", "helen", "anna", "brenda", "pamela", "nicole", "samantha",
        "katherine", "christine", "debra", "rachel", "catherine", "maria",
        "heather", "diane", "julie", "olivia", "joyce", "victoria", "ruth",
        "virginia", "lauren", "kelly", "christina", "joan", "evelyn", "judith",
        "megan", "andrea", "cheryl", "hannah", "jane", "grace", "chloe",
        "priya", "raj", "amit", "vikram", "arjun", "rohan", "ananya", "diya",
        "kiran", "neha", "pooja", "sanjay", "rahul", "aditya", "isha", "riya",
        "sara", "aisha", "omar", "ahmed", "wei", "li", "yuki", "haruto",
        "chen", "yan", "ravi", "deepak", "joshua", "joo", "shreya", "ishaan",
        "kabir", "aryan", "meera", "ahmad", "fatima", "layla", "yusuf",
        "mohammed", "hassan", "chris", "alex", "sam", "max", "ben", "leo",
        "mia", "zoe", "eva", "noah", "liam", "emma", "ava", "sofia", "isla",
    }

    # Common surnames — used to validate the *second* token in a two-token
    # split, which sharply reduces false first/last swaps.
    SURNAMES: Set[str] = {
        "smith", "johnson", "williams", "brown", "jones", "garcia", "miller",
        "davis", "rodriguez", "martinez", "hernandez", "lopez", "gonzalez",
        "wilson", "anderson", "thomas", "taylor", "moore", "jackson", "martin",
        "lee", "perez", "thompson", "white", "harris", "sanchez", "clark",
        "ramirez", "lewis", "robinson", "walker", "young", "allen", "king",
        "wright", "scott", "torres", "nguyen", "hill", "flores", "green",
        "adams", "nelson", "baker", "hall", "rivera", "campbell", "mitchell",
        "carter", "roberts", "gomez", "phillips", "evans", "turner", "diaz",
        "parker", "cruz", "edwards", "collins", "reyes", "stewart", "morris",
        "morales", "murphy", "cook", "rogers", "gutierrez", "ortiz", "morgan",
        "cooper", "peterson", "bailey", "reed", "kelly", "howard", "ramos",
        "kim", "cox", "ward", "richardson", "watson", "brooks", "chavez",
        "wood", "james", "bennett", "gray", "mendoza", "ruiz", "hughes",
        "price", "alvarez", "castillo", "sanders", "patel", "kumar", "sharma",
        "singh", "gupta", "shah", "mehta", "chen", "wang", "zhang", "liu",
        "khan", "hussain", "ali", "yamamoto", "tanaka", "suzuki", "kanatt",
        "iyer", "nair", "menon", "pillai", "rao", "reddy", "das", "roy",
    }

    NAME_PARTICLES: List[Tuple[str, str]] = [
        ("mc", "Mc"), ("mac", "Mac"), ("o'", "O'"), ("van", "van"),
        ("von", "von"), ("de", "de"), ("del", "del"), ("la", "la"),
        ("al", "al"),
    ]

    # Splits on separators AND on digit runs, so "john99smith" -> john, smith
    SEPARATORS = re.compile(r"[._\-+]+|\d+")
    EMAIL_FINDER = re.compile(
        r"[a-zA-Z0-9][a-zA-Z0-9._%+\-]*@[a-zA-Z0-9][a-zA-Z0-9.\-]*\.[a-zA-Z]{2,}"
    )


# ---------------------------------------------------------------------------
# Result object
# ---------------------------------------------------------------------------

@dataclass
class ExtractionResult:
    email: str
    is_valid_email: bool = False
    is_role_account: bool = False
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    pattern: Optional[str] = None
    confidence: float = 0.0
    fallback_used: bool = False
    reasoning: List[str] = field(default_factory=list)

    def __repr__(self) -> str:
        return (f"ExtractionResult(email={self.email!r}, "
                f"full_name={self.full_name!r}, "
                f"confidence={self.confidence:.2f}, "
                f"pattern={self.pattern!r}, "
                f"fallback_used={self.fallback_used})")


# ---------------------------------------------------------------------------
# Team member 1: RawTextEmailFinder
# ---------------------------------------------------------------------------

class RawTextEmailFinder:
    """Extracts every email-looking substring out of arbitrary pasted text."""

    def find_all(self, text: str) -> List[str]:
        return ReferenceData.EMAIL_FINDER.findall(text or "")


# ---------------------------------------------------------------------------
# Team member 2: Sanitizer
# ---------------------------------------------------------------------------

class Sanitizer:
    """Validates a single email and splits it into local-part / domain."""

    EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

    def process(self, raw_email: str) -> Tuple[bool, str, str]:
        cleaned = (raw_email or "").strip().lower()
        if not self.EMAIL_RE.match(cleaned):
            return False, cleaned, ""
        local, domain = cleaned.split("@", 1)
        local = local.split("+", 1)[0]  # strip plus-addressing tags
        local = re.sub(r"[^a-z0-9._\-]", "", local)  # drop stray characters
        return bool(local), local, domain


# ---------------------------------------------------------------------------
# Team member 3: RoleAccountDetector
# ---------------------------------------------------------------------------

class RoleAccountDetector:
    def is_role_account(self, local_part: str) -> bool:
        stripped = re.sub(r"[._\-\d]+", "", local_part)
        if local_part in ReferenceData.ROLE_TOKENS:
            return True
        if stripped in ReferenceData.ROLE_TOKENS:
            return True
        tokens = ReferenceData.SEPARATORS.split(local_part)
        return any(t in ReferenceData.ROLE_TOKENS for t in tokens if t)


# ---------------------------------------------------------------------------
# Team member 4: TokenSplitter
# ---------------------------------------------------------------------------

class TokenSplitter:
    def split(self, local_part: str) -> List[str]:
        raw_tokens = ReferenceData.SEPARATORS.split(local_part)
        tokens = [t for t in raw_tokens if t and not t.isdigit() and len(t) >= 1]
        return tokens


# ---------------------------------------------------------------------------
# Team member 5: NameSegmenter
# ---------------------------------------------------------------------------

class NameSegmenter:
    """DP word-split for fused tokens, cross-checked against both dictionaries."""

    def __init__(self, first_names: Set[str], surnames: Set[str]):
        self.first_names = first_names
        self.surnames = surnames

    def segment(self, token: str) -> Optional[Tuple[str, str]]:
        n = len(token)
        if n < 4:
            return None
        best: Optional[Tuple[str, str]] = None
        best_score = -1
        for i in range(2, n - 1):
            head, tail = token[:i], token[i:]
            score = 0
            if head in self.first_names:
                score += 3
            if tail in self.surnames:
                score += 3
            if score == 0 and len(tail) >= 2:
                score += 1
            if score > best_score:
                best_score = score
                best = (head, tail)
        if best and best_score >= 3:
            return best
        return None


# ---------------------------------------------------------------------------
# Team member 6: PatternClassifier
# ---------------------------------------------------------------------------

class PatternClassifier:
    def __init__(self, first_names: Set[str], surnames: Set[str], segmenter: NameSegmenter):
        self.first_names = first_names
        self.surnames = surnames
        self.segmenter = segmenter

    def classify(self, tokens: List[str]) -> Tuple[Optional[str], Optional[str], str, List[str]]:
        reasoning: List[str] = []

        if len(tokens) >= 3:
            # first.middle.last -> use first and last tokens, note the middle
            first, last = tokens[0], tokens[-1]
            reasoning.append(f"Three or more tokens; treated '{tokens[1:-1]}' as middle name(s)")
            if len(first) == 1:
                first, last = last, tokens[0]
                reasoning.append("First token was a single initial; swapped order")
            return first, last, "multi_token_first_last", reasoning

        if len(tokens) == 2:
            a, b = tokens[0], tokens[1]
            if len(a) == 1 and len(b) > 1:
                reasoning.append("Detected initial + name pattern (f.last)")
                return b, None, "initial_dot_last", reasoning
            if len(b) == 1 and len(a) > 1:
                reasoning.append("Detected name + initial pattern (last.f)")
                return a, None, "last_dot_initial", reasoning

            a_first, a_last = a in self.first_names, a in self.surnames
            b_first, b_last = b in self.first_names, b in self.surnames

            if a_first and b_last and not (b_first and a_last):
                reasoning.append(f"'{a}' is a known first name, '{b}' is a known surname")
                return a, b, "first_dot_last", reasoning
            if b_first and a_last and not (a_first and b_last):
                reasoning.append(f"'{b}' is a known first name, '{a}' is a known surname; order reversed")
                return b, a, "last_dot_first", reasoning
            if a_first and not b_first:
                reasoning.append(f"'{a}' matched first-name dictionary only; assumed first.last")
                return a, b, "first_dot_last", reasoning
            if b_first and not a_first:
                reasoning.append(f"'{b}' matched first-name dictionary only; assumed last.first order")
                return b, a, "last_dot_first", reasoning
            reasoning.append("Two tokens, no strong dictionary signal; defaulted to first.last order")
            return a, b, "first_dot_last_assumed", reasoning

        if len(tokens) == 1:
            token = tokens[0]
            if token in self.first_names:
                reasoning.append(f"Single token '{token}' matched first-name dictionary")
                return token, None, "single_first_name", reasoning
            if token in self.surnames:
                reasoning.append(f"Single token '{token}' matched surname dictionary")
                return token, None, "single_surname", reasoning
            split = self.segmenter.segment(token)
            if split:
                first, last = split
                reasoning.append(f"Segmented fused token '{token}' into '{first}' + '{last}'")
                return first, last, "concatenated_first_last", reasoning
            if len(token) >= 2:
                reasoning.append(f"Single unresolved token '{token}'; treated as first name only")
                return token, None, "single_unknown_token", reasoning
            reasoning.append(f"Token '{token}' too short to be a name")
            return None, None, "unresolved", reasoning

        reasoning.append("No usable tokens found")
        return None, None, "unresolved", reasoning


# ---------------------------------------------------------------------------
# Team member 7: Capitalizer
# ---------------------------------------------------------------------------

class Capitalizer:
    def capitalize(self, fragment: Optional[str]) -> Optional[str]:
        if not fragment:
            return None
        for prefix, styled in ReferenceData.NAME_PARTICLES:
            if fragment.startswith(prefix) and len(fragment) > len(prefix) + 1:
                rest = fragment[len(prefix):]
                return styled + rest[0].upper() + rest[1:]
        return fragment[0].upper() + fragment[1:]


# ---------------------------------------------------------------------------
# Team member 8: ConfidenceScorer
# ---------------------------------------------------------------------------

class ConfidenceScorer:
    PATTERN_BASE_SCORE = {
        "first_dot_last": 0.93,
        "last_dot_first": 0.85,
        "multi_token_first_last": 0.80,
        "initial_dot_last": 0.65,
        "last_dot_initial": 0.60,
        "concatenated_first_last": 0.72,
        "single_first_name": 0.55,
        "single_surname": 0.50,
        "first_dot_last_assumed": 0.48,
        "single_unknown_token": 0.30,
        "unresolved": 0.0,
    }

    def score(self, pattern: str, has_last_name: bool) -> float:
        base = self.PATTERN_BASE_SCORE.get(pattern, 0.2)
        if not has_last_name and pattern not in ("single_first_name", "single_surname", "single_unknown_token"):
            base -= 0.15
        return max(0.0, min(1.0, base))


# ---------------------------------------------------------------------------
# Team member 9: FallbackGuard
# ---------------------------------------------------------------------------

class FallbackGuard:
    """Last line of defense. Ensures every result carries a usable name."""

    def apply(self, result: ExtractionResult) -> ExtractionResult:
        if not result.full_name or not result.full_name.strip():
            result.full_name = ReferenceData.FALLBACK_NAME
            result.first_name = None
            result.last_name = None
            result.confidence = 0.0
            result.fallback_used = True
            result.reasoning.append(
                f"No resolvable name; defaulted to '{ReferenceData.FALLBACK_NAME}'"
            )
        return result


# ---------------------------------------------------------------------------
# Team lead: ExtractionPipeline
# ---------------------------------------------------------------------------

class ExtractionPipeline:
    """Coordinates the full team, end to end. Guarantees a result per email,
    never raises, never returns a blank name."""

    def __init__(self, reference: Optional[ReferenceData] = None, min_confidence: float = 0.35):
        ref = reference or ReferenceData()
        self.finder = RawTextEmailFinder()
        self.sanitizer = Sanitizer()
        self.role_detector = RoleAccountDetector()
        self.token_splitter = TokenSplitter()
        self.segmenter = NameSegmenter(ref.FIRST_NAMES, ref.SURNAMES)
        self.classifier = PatternClassifier(ref.FIRST_NAMES, ref.SURNAMES, self.segmenter)
        self.capitalizer = Capitalizer()
        self.scorer = ConfidenceScorer()
        self.guard = FallbackGuard()
        # Results scoring below this bar are treated as unreliable and
        # routed to the "Hiring Manager" fallback instead of being shown
        # as a guessed name. Set to 0.0 to disable this floor entirely.
        self.min_confidence = min_confidence

    def run(self, raw_email: str) -> ExtractionResult:
        result = ExtractionResult(email=(raw_email or "").strip())
        try:
            is_valid, local_part, domain = self.sanitizer.process(raw_email)
            result.is_valid_email = is_valid
            if not is_valid:
                result.reasoning.append("Failed basic email format validation")
                return self.guard.apply(result)

            if self.role_detector.is_role_account(local_part):
                result.is_role_account = True
                result.reasoning.append(f"Local-part '{local_part}' matched a role-account keyword")
                return self.guard.apply(result)

            tokens = self.token_splitter.split(local_part)
            if not tokens:
                result.reasoning.append("No alphabetic tokens survived splitting")
                return self.guard.apply(result)

            first_raw, last_raw, pattern, reasoning = self.classifier.classify(tokens)
            result.reasoning.extend(reasoning)
            result.pattern = pattern

            result.first_name = self.capitalizer.capitalize(first_raw)
            result.last_name = self.capitalizer.capitalize(last_raw)
            result.full_name = " ".join(p for p in (result.first_name, result.last_name) if p)
            result.confidence = self.scorer.score(pattern, has_last_name=bool(result.last_name))

            if result.confidence < self.min_confidence:
                result.reasoning.append(
                    f"Confidence {result.confidence:.2f} below floor {self.min_confidence:.2f}"
                )
                result.first_name = None
                result.last_name = None
                result.full_name = None

            return self.guard.apply(result)

        except Exception as exc:  # noqa: BLE001 - guarantee no crash reaches the caller
            result.reasoning.append(f"Internal error suppressed: {exc}")
            return self.guard.apply(result)

    def run_batch(self, emails: List[str]) -> List[ExtractionResult]:
        return [self.run(e) for e in emails]

    def run_from_text(self, pasted_text: str) -> List[ExtractionResult]:
        """Accepts anything pasted in: a single email, a list of emails,
        or a messy block of text with emails embedded in it."""
        found = self.finder.find_all(pasted_text)
        if not found:
            fallback = ExtractionResult(email=pasted_text.strip() if pasted_text else "")
            return [self.guard.apply(fallback)]
        return self.run_batch(found)


# ---------------------------------------------------------------------------
# Demo / CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    test_emails = [
        "jane.doe@company.com",
        "j.smith@company.com",
        "smith.j@company.com",
        "johnsmith@company.com",
        "priya.sharma@startup.io",
        "info@company.com",
        "noreply@notifications.com",
        "kabir123@gmail.com",
        "a@b.com",
        "not-an-email",
        "hr.team@company.com",
        "john.michael.doe@company.com",
        "recruiting-2024@company.com",
        "xk92q@company.com",
    ]

    pipeline = ExtractionPipeline()
    print(f"{'EMAIL':32} {'NAME':22} {'CONF':6} {'FALLBACK':9} {'PATTERN'}")
    print("-" * 100)
    for res in pipeline.run_batch(test_emails):
        print(f"{res.email:32} {res.full_name:22} {res.confidence:<6.2f} "
              f"{str(res.fallback_used):9} {res.pattern or '-'}")

    print("\n--- run_from_text() demo: pasting a messy block ---")
    blob = """
    Hey, reach out to jane.doe@company.com or j.smith@company.com about the role.
    CC recruiting@company.com and rohan_kapoor99@gmail.com.
    """
    for res in pipeline.run_from_text(blob):
        print(res)
