# Submission kit

Working material for the Colosseum Crypto World's Fair submission (closes 12 October 2026, 23:59 PT, which is 13 October 13:59 WIB). Everything submitted must be in English. Items in [brackets] are for the team to fill in; nothing here should be submitted with a bracket left in it.

## One-liner

Tsamara turns a sovereign sukuk series into $10 units on Solana, with the rules of who may hold and transfer them enforced by the token itself.

## Short description

Sovereign dollar sukuk are sold to institutions in lots of US$200,000 and trade over the counter. Tsamara represents a series as a Token-2022 token in $10 units. Investor accounts stay frozen until identity verification passes; a transfer hook program checks every recipient's eligibility and holding cap on every transfer; subscriptions settle payment against delivery in one transaction; periodic distributions are paid in stablecoins. It is a devnet prototype with a mock series: not an offer, not licensed, not sharia-certified.

## Form answers

| Field | Answer |
|---|---|
| Product name | Tsamara |
| Chains | Solana (devnet) |
| Tools | Token-2022 (metadata, default frozen accounts, transfer hook), Anchor, the Carbon indexing framework, Sumsub (sandbox), Next.js, TanStack Query and Table, Hono, Astro, LiteSVM, Biome |
| Repository | https://github.com/tsamara-xyz/tsamara (public, MIT) |
| Live links | https://tsamara.xyz and https://app.tsamara.xyz [confirm both load before submitting] |
| Program | `EjYxuJE4QE8P37scBxgWRHGigZ8hP6j3ysnSQ95MWXXG` on devnet |
| Team and location | [names, roles, city; relevant background in sharia finance and tokenization, stated truthfully] |
| Logo | `apps/landing/public/android-chrome-512x512.png` |

**Development history, to disclose as asked.** All code in the repository was written during the hackathon period; there is no pre-existing codebase. It was written with an AI coding assistant, and the commits say so. The landing page layout follows a third-party template, and its imagery and display font are loaded from that template's hosts (issue #31).

**Go-to-market, demand and distribution.** [Team to write, truthfully. The honest outline from the research in docs/REGULATION.md: a first real issuance is for professional investors in one jurisdiction through a tokenization sandbox such as ADGM, DIFC or Singapore, with a licensed custodian, registrar and placement agent; a rupiah-settled domestic series through Indonesia's regulatory sandbox runs in parallel; retail access at $10 needs an approved prospectus, an authorised fund, or native issuance by a sovereign. State any real conversations, pilots or letters of intent; do not imply any that do not exist.]

## Pitch video (2 to 3 minutes)

Judges watch this first. Lead with the problem and the team, not the technology.

1. **Problem, 20 seconds.** "The sovereign sukuk market is large, and almost nobody can buy into it directly. Dollar sukuk are sold to institutions in lots of two hundred thousand dollars and trade over the counter."
2. **Who we are, 20 seconds.** [Why this team: background, what you have seen first-hand, why you care.]
3. **What Tsamara is, 30 seconds.** "Tsamara represents a sukuk series as a token in ten-dollar units. The rules a regulated instrument needs are properties of the token: accounts are frozen until identity verification passes, every transfer checks the recipient's eligibility and holding cap, and payment and delivery settle in one transaction." Show the app's explore page and an asset page.
4. **Why it is different, 30 seconds.** "Permissioned tokens are becoming a standard on Solana. What is missing is the sukuk itself: a structure that stays tradable under sharia rules, terms that are public, and distribution to people who cannot meet institutional minimums. We publish the structure and the share of tangible assets onchain, we model the return as an expected profit rate rather than interest, and we know which parts are not software."
5. **What is real today, 20 seconds.** "A working prototype on devnet: a compliance program, an indexer, an operator API with identity verification, and a web app, all open source and tested end to end."
6. **What comes next, 30 seconds.** "A first issuance for professional investors through a tokenization sandbox, and a rupiah-settled series through Indonesia's regulatory sandbox. Retail access is the goal, and it needs a licensed path we do not have yet." [Only claim steps you are actually taking.]
7. **Close, 10 seconds.** The one-liner, and the URL.

Do not say: compliant, regulated, sharia-compliant, halal, guaranteed, coupon, interest, available to everyone, backed by a government.

## Demo video (3 minutes at most)

Record at https://app.tsamara.xyz, or locally with the three services running. Rename the Sumsub workspace first: its first screen shows the workspace name.

1. **Explore.** One live series and two marked Preview; the cards read from the indexer.
2. **Asset page.** Terms, expected profit rate, tangible assets, restricted jurisdictions, onchain addresses.
3. **Connect** the test wallet and request test dollars.
4. **Verify identity.** Open the Sumsub dialog, complete it, and show the panel unlock. In the sandbox, the Operator page completes the review.
5. **Subscribe** to 10 units; open the transaction in the explorer and point at the two instructions in one transaction.
6. **Portfolio.** The holding, the allocation and the history.
7. **A refusal.** Try to send units to a wallet that has not onboarded; show the explanation. Say that a restricted jurisdiction and an over-cap transfer are refused by the program, and that the tests prove both.
8. **Operator.** Pay a distribution and show it arrive in the investor's history.

## Before submitting

- [ ] Arena profile complete for every team member, each registered before the deadline
- [ ] Both sites load over HTTPS, and the API smoke test passes against them
- [ ] Sumsub workspace renamed
- [ ] Pitch video is 2 to 3 minutes; demo video is 3 minutes or less
- [ ] Every bracket in this document has been replaced, and no claim is made that docs/REGULATION.md says we must not make
- [ ] Submit well before the last hour
