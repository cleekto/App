# KleeKto — Phase 00.5 Contract Reconciliation — 2026-09-20

**Status:** ACCEPTED / CONTRACTS RECONCILED  
**Precondition:** Phase 00 Repository Audit completed READ-ONLY  
**Purpose:** Resolve the owner decisions and specification drift found by Phase 00 before any code mutation.

## Decisions

1. **Phone evidence**
   - Allowed: `REVEALED_ON_SOURCE`, `MANUAL_AGENT_INPUT`.
   - Extension never automates native phone reveal.
   - No valid evidence = no import.

2. **Canonical specialized contracts**
   - RBAC owns permission identifiers.
   - Event Catalog owns event envelope, actor set, payload and event names.
   - API Specification owns commands/routes.
   - Database Specification owns persistence semantics.
   - Frozen remains the product boundary and must summarize, not contradict, specialized contracts.

3. **Legacy truth**
   - Do not fabricate consent, Deal Won, or other historical facts.
   - Preserve unknown/legacy-unverified state explicitly.
   - Preserve legacy IDs/timestamps/provenance where possible.

4. **Shared phone**
   - Phone is strong identity evidence, not an unconditional unique person key.
   - Multiple Owner candidates may share one normalized phone.
   - Ambiguity requires review; no silent merge.

5. **Market storage**
   - Tenant business state remains company-scoped.
   - A platform-level cache may hold public marketplace facts only.
   - Tenant-private contact/consent/claim/archive/client/deal state never crosses company boundaries.

6. **myhome.ge**
   - No anti-bot/access-control bypass.
   - Use only permitted stable access paths.
   - A disabled/unavailable required provider remains an MVP release blocker.

7. **Visual contract**
   - Final dark-first premium PropTech terminal direction remains unchanged and binding.

## Final owner decisions — 2026-09-21

The Frozen representative event list now uses these canonical names:

- `source_listing.observed` → `source.observed`
- `source_listing.updated` → `source.changed`
- `opportunity.released` → `opportunity.claim_released`
- `publication.ready` → `publication.prepared`
- `security.permission_denied` → `security.authorization_denied`

The owner approved removal of these undefined names from the event list
only: `source_listing.off_market`, `owner.resolved`,
`publication.created`, `publication.preparing`, `publication.filling`,
and `publication.awaiting_confirmation`. Their associated domain
concepts, lifecycle states and workflows are retained. No new events
are introduced in the Event Catalog.

Hidden source phone blocks extension import only without valid
`MANUAL_AGENT_INPUT` evidence. The negative scenario requires both a
hidden source phone and absent valid manual evidence; remediation allows
native reveal or valid manual phone input. Both evidence modes remain
allowed, and the extension never automates native reveal.

## Implementation gate

No production code changes were authorized by this reconciliation itself.

The first code-changing phase may begin only from the reconciled contracts
and should start with the Phase 00 security/foundation blockers:
SSRF, ingest trust boundaries, canonical authorization enforcement,
sensitive-denial audit, safe test-DB isolation, and publication guards.

Event/Outbox/ProcessedEvent foundation follows after the first security
slice unless implementation dependency requires a smaller atomic subset.
