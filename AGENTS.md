# Permissionless Freelance Escrow

## Short Pitch

A permissionless escrow protocol for freelance work. Clients commit funds upfront, freelancers can verify that their milestones are funded, and both parties agree on deliverables, deadlines, acceptance criteria, and dispute resolution before work begins. A frontend and CLI make the same agreements accessible to people and software, without requiring a privileged platform intermediary.

The same agreements can also coordinate work and payment between humans, AI agents, or both.

## Project Description

The core product is escrow for clients and freelancers who want to work together without handing control of their agreement and payment to a freelance marketplace.

A client and freelancer define an agreement, divide work into milestones, and choose the rules governing delivery, review, payment, cancellation, and disputes. The client locks the required funds in escrow. The freelancer verifies funding before starting work, submits deliverables against the agreed criteria, and receives payment through the agreed approval or resolution process.

The protocol enforces financial commitments and authorized settlement rules. It cannot determine whether every creative or subjective deliverable is satisfactory. Those judgments belong to the review and resolution process selected by the participants.

Permissionless participation means that creating and using an agreement does not require platform membership or discretionary platform approval. The product supplies a convenient interface; the agreement remains independently accessible.

## Agreements and Funded Milestones

Each agreement identifies the requester (client), provider (freelancer), and chosen dispute-resolution mechanism. It records or commits to the terms both parties accepted, including:

- The scope of work and expected deliverables.
- Milestone amounts, payment asset, and funding requirements.
- Explicit acceptance criteria and the evidence needed to demonstrate completion.
- Delivery deadlines and the event that starts each deadline.
- Review periods, permitted revisions, and any limits on revision cycles.
- Approval, cancellation, refund, dispute, and timeout rules.
- Resolver authority, fees, response deadlines, and fallback behavior.

Milestones make larger projects manageable. Each milestone has its own deliverable, funding status, review window, and settlement outcome. Agreements can be funded fully upfront or incrementally, but the interface must distinguish money already locked from future funding promises.

**Proof of funds means verifiable funds committed to the relevant escrow milestone.** A wallet balance or a client's promise to pay is insufficient. The freelancer should be able to inspect the funded amount and the conditions under which it may be released or refunded before accepting or starting that milestone. Funding is evidence of available payment, not a guarantee that a disputed claim will be paid.

Changes affecting active commitments require the consent specified by the agreement. Neither party should be able to unilaterally rewrite acceptance criteria, replace the resolver, or withdraw committed funds outside the agreed rules.

## Acceptance, Deadlines, and Timeout Protection

Acceptance criteria should describe observable results rather than vague expectations. For subjective work, the agreement should specify the brief, required deliverables, review process, and scope of revisions. For objective work, it can define measurable checks.

Submission starts a bounded review period. During that period, the client can approve the milestone or use the agreed revision or dispute process. A rejection should identify which acceptance criteria were not met and provide relevant evidence.

Every waiting state needs a defined exit. The agreement must specify what happens when:

- A proposed agreement is never accepted.
- A required milestone is not funded.
- The provider misses a delivery deadline.
- The requester does not review a timely submission.
- A requested revision is not delivered or reviewed.
- A resolver fails to respond within its allowed period.

Timeout protection prevents either party from keeping funds locked indefinitely through silence. Outcomes may include an eligible refund, release after an unchallenged review window, or escalation to a preselected fallback. The applicable outcome and any challenge period must be visible and accepted before work begins.

Missing a deadline should not silently override a timely submission or an active dispute. The rules must make clear which state takes precedence and who can trigger the next action. A timeout makes an action eligible; where settlement needs a transaction, an interface or participant must still submit it.

## Pluggable Dispute Resolution

There is no privileged platform judge. Participants choose their resolution mechanism before committing to the agreement, and that mechanism receives only the authority defined in the accepted terms.

Possible mechanisms include a mutually selected human arbitrator, an independent arbitration service, a group decision process, or an automated verifier for objectively checkable work. Different agreements can use different mechanisms.

The agreement defines what evidence the resolver can consider, how a dispute is raised, who pays resolution fees, which settlement outcomes are allowed, and how resolver inactivity is handled. Depending on those terms, outcomes can include payment, refund, or a split of the disputed funds.

Pluggability means participants choose their trust model. It does not make a subjective judgment objective or remove the need to trust a selected arbitrator. The platform must not gain an implicit right to override outcomes simply because it supplies the frontend.

## Interaction Options and Interface Independence

The product offers two first-class interaction options:

- **Frontend:** a guided experience for creating agreements, checking funding, reviewing milestones, submitting work, approving payments, and handling disputes.
- **CLI:** a complete command-line workflow for creating, inspecting, funding, accepting, submitting, approving, disputing, and settling agreements, including eligible timeout actions.

Both interfaces act on the same agreements and expose the same rules. Users should be able to continue an agreement through another compatible interface if the original frontend becomes unavailable. Agreement identifiers, terms, funding status, deadlines, evidence references, and settlement history should be inspectable without dependence on a single website.

The CLI should support machine-readable input and output so that scripts and autonomous participants can use the protocol reliably.

## Privacy-Aware Design

Freelance work often involves confidential briefs, unpublished assets, proprietary code, or personal information. Public settlement should not require publishing those materials.

Keep public agreement data to what is necessary for commitments, authorization, timing, and settlement. Sensitive briefs, deliverables, and dispute evidence can be shared separately with the participants and, where necessary, the selected resolver. References or cryptographic commitments can bind an agreement to particular materials without exposing their full contents.

Privacy requires careful handling beyond the escrow itself. Public addresses, amounts, timestamps, and interaction patterns can reveal relationships. A commitment alone does not ensure confidentiality or continued access to a deliverable. Participants need an explicit way to retain and share the evidence required for review or resolution.

The interface should explain what becomes public and who can access private materials before submission.

## Initial Product Flow

1. **Define the work.** The client drafts an agreement with a freelancer, milestones, acceptance criteria, payment amounts, deadlines, review periods, and resolution rules.
2. **Confirm the terms.** Both parties inspect and accept the same terms, including timeout outcomes and resolver authority.
3. **Fund the milestone.** The client commits the required funds. The freelancer verifies the escrow balance and relevant release conditions before starting work.
4. **Perform and submit.** The freelancer completes the milestone and submits the agreed deliverable or evidence reference. Submission records the start of the review period.
5. **Review.** The client approves, requests a revision within the agreed scope, or raises a dispute within the allowed window.
6. **Settle.** Approval releases payment. A dispute follows the selected resolution mechanism. Inactivity follows the agreed timeout process.
7. **Continue or close.** The parties proceed to the next funded milestone or close the agreement with a clear record of payments, refunds, and unresolved obligations, if any.

The initial product should make this lifecycle understandable and usable end to end. Its value is reliable agreements and settlement for freelance work; a discovery marketplace or reputation system is not required to demonstrate that value.

## AI Agents and Autonomous Participants

### A Natural Extension of the Freelance Product

Freelance escrow remains the core product. Agent participation extends the same agreement model to software acting on behalf of a person or organization.

The protocol uses neutral roles: **requester**, **provider**, and **resolver**. Any of these roles can be fulfilled by a human or an agent, subject to the agreement's authorization rules. A resolver can also be a deterministic program or an external service. The human-facing interface can continue to use familiar labels such as client and freelancer.

This supports human-to-human work, a human hiring an agent, an agent hiring a human specialist, and agreements between two agents. Each combination still needs a clear scope, committed funds, acceptance criteria, deadlines, and a settlement process.

### Automated Verification for Objective Work

Some agent tasks have acceptance criteria that can be checked automatically: computing file hashes, transforming data according to a precise specification, or producing an output that passes an agreed validation suite.

Participants can select an automated verifier and agree on its checks before work begins. The agreement must distinguish a verifier's result from its authority: a check may support a requester's approval, or the chosen mechanism may be authorized to settle directly.

Passing a format check does not prove that a research report is accurate or that creative work is good. Automated verification is appropriate only to the extent that the specified checks establish the agreed result. Subjective work may still require human review or arbitration.

Agents use the same CLI-accessible lifecycle as other participants. They should operate within explicit spending limits and signing permissions, and inspect funding and accepted terms before undertaking work.

### Flagship Demo: Two Agents, Two Terminals

Run a requester agent and a provider agent side by side in two terminals on testnet. The agents complete and settle a real agreement using testnet funds, with observable transactions and agreement state changes.

Use a small, deterministic task, such as producing hashes and metadata for a fixed set of files:

1. The requester creates an agreement specifying the files, expected output, payment, delivery deadline, review window, and verification rules.
2. The requester funds the milestone, and its terminal displays the agreement identifier and funding confirmation.
3. The provider inspects the terms, verifies funding, accepts the agreement, and performs the work.
4. The provider submits its result and the required evidence.
5. The agreed verifier checks the result. The requester approves, or the authorized verification mechanism triggers settlement, according to the chosen terms.
6. The provider receives the testnet payment. Both terminals display the settled state, and an explorer shows the underlying transactions.

A second scenario should submit an invalid result, demonstrate that successful payment is not authorized by the failed check, and follow the agreed dispute or timeout path to its outcome.

The demo should exercise actual escrow funding, submission, verification, and settlement rather than simulate those events in terminal output. Testnet balances and payments should be clearly labeled.

The message is straightforward: two independent participants can agree on work, commit payment, verify a result, and settle through rules chosen in advance. Whether those participants are people or agents does not change the core freelance escrow proposition.
