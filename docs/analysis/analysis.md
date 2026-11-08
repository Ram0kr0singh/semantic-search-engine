# Per-query statistical analysis

All values are calculated from the committed per-query snapshots. P-values use a two-sided centered paired bootstrap with add-one correction: resample differences centered at their observed mean; p = (count_extreme + 1) / (resamples + 1), where count_extreme is the number of null bootstrap means with absolute value at least the observed absolute mean. Each bootstrap comparison is seeded from a stable hash of the global seed, dataset, metric, method A, and method B; this made confidence intervals of earlier comparisons shift slightly in the third decimal once.

## fiqa

### Paired comparisons

#### ndcg_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | 0.073529 | [0.058726, 0.088342] | < 0.0001 | 0.001600 | 204 | 62 | 382 |
| MiniLM − BM25 | 0.146366 | [0.121246, 0.171525] | < 0.0001 | 0.001600 | 322 | 101 | 225 |
| MPNet − BM25 | 0.277327 | [0.250006, 0.303742] | < 0.0001 | 0.001600 | 417 | 64 | 167 |
| MPNet − MiniLM | 0.130961 | [0.111052, 0.150648] | < 0.0001 | 0.001600 | 323 | 93 | 232 |
| Hybrid (MPNet) − BM25 | 0.176789 | [0.159704, 0.194074] | < 0.0001 | 0.001600 | 376 | 24 | 248 |
| Hybrid (MPNet) − MPNet | -0.100538 | [-0.121781, -0.079332] | < 0.0001 | 0.001600 | 144 | 298 | 206 |
| Hybrid (MiniLM) − BM25 | 0.109757 | [0.094132, 0.124810] | < 0.0001 | 0.001600 | 300 | 52 | 296 |
| Hybrid (MiniLM) − MiniLM | -0.036609 | [-0.056607, -0.017021] | 0.000300 | 0.002700 | 162 | 215 | 271 |

#### recall_at_100

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | 0.046082 | [0.025570, 0.066794] | < 0.0001 | 0.001600 | 102 | 48 | 498 |
| MiniLM − BM25 | 0.192871 | [0.162185, 0.222839] | < 0.0001 | 0.001600 | 259 | 44 | 345 |
| MPNet − BM25 | 0.306506 | [0.275565, 0.338078] | < 0.0001 | 0.001600 | 335 | 16 | 297 |
| MPNet − MiniLM | 0.113635 | [0.092860, 0.134407] | < 0.0001 | 0.001600 | 172 | 17 | 459 |
| Hybrid (MPNet) − BM25 | 0.285103 | [0.256919, 0.312937] | < 0.0001 | 0.001600 | 321 | 4 | 323 |
| Hybrid (MPNet) − MPNet | -0.021403 | [-0.035710, -0.007465] | 0.002600 | 0.020798 | 21 | 64 | 563 |
| Hybrid (MiniLM) − BM25 | 0.182343 | [0.157140, 0.207888] | < 0.0001 | 0.001600 | 231 | 14 | 403 |
| Hybrid (MiniLM) − MiniLM | -0.010528 | [-0.026112, 0.005468] | 0.189381 | 0.568143 | 45 | 69 | 534 |

### Tuned-hybrid comparisons (separate Holm family)

This separate family compares the pre-specified development-selected weighted hybrid on test queries. These adjusted p-values do not alter the earlier comparison family.

#### ndcg_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Hybrid-tuned (MiniLM) − Hybrid (MiniLM) | 0.042699 | [0.027623, 0.058083] | < 0.0001 | 0.001200 | 218 | 122 | 308 |
| Hybrid-tuned (MiniLM) − MiniLM | 0.006090 | [-0.003020, 0.014944] | 0.186981 | 0.560944 | 144 | 118 | 386 |
| Hybrid-tuned (MiniLM) − BM25 | 0.152456 | [0.129533, 0.175417] | < 0.0001 | 0.001200 | 336 | 82 | 230 |
| Hybrid-tuned (MPNet) − Hybrid (MPNet) | 0.100538 | [0.079563, 0.122530] | < 0.0001 | 0.001200 | 298 | 144 | 206 |
| Hybrid-tuned (MPNet) − MPNet | 0.000000 | [0.000000, 0.000000] | 1.000000 | 1.000000 | 0 | 0 | 648 |
| Hybrid-tuned (MPNet) − BM25 | 0.277327 | [0.250111, 0.304084] | < 0.0001 | 0.001200 | 417 | 64 | 167 |

#### recall_at_100

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Hybrid-tuned (MiniLM) − Hybrid (MiniLM) | 0.010528 | [-0.005005, 0.026025] | 0.182982 | 1.000000 | 69 | 45 | 534 |
| Hybrid-tuned (MiniLM) − MiniLM | 0.000000 | [0.000000, 0.000000] | 1.000000 | 1.000000 | 0 | 0 | 648 |
| Hybrid-tuned (MiniLM) − BM25 | 0.192871 | [0.162623, 0.223393] | < 0.0001 | 0.001200 | 259 | 44 | 345 |
| Hybrid-tuned (MPNet) − Hybrid (MPNet) | 0.021403 | [0.007396, 0.035205] | 0.002600 | 0.018198 | 64 | 21 | 563 |
| Hybrid-tuned (MPNet) − MPNet | 0.000000 | [0.000000, 0.000000] | 1.000000 | 1.000000 | 0 | 0 | 648 |
| Hybrid-tuned (MPNet) − BM25 | 0.306506 | [0.274434, 0.338052] | < 0.0001 | 0.001200 | 335 | 16 | 297 |

### Reranking comparisons (separate Holm family)

This separate family is the pre-specified cross-encoder reranking comparison. Recall@100 is excluded because reranking only reorders the same 100 first-stage candidates.

#### ndcg_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Rerank (BM25) − BM25 | 0.109839 | [0.091829, 0.127878] | < 0.0001 | 0.001000 | 256 | 70 | 322 |
| Rerank (MPNet) − MPNet | -0.095509 | [-0.118185, -0.073172] | < 0.0001 | 0.001000 | 133 | 304 | 211 |
| Rerank (Hybrid MPNet) − Hybrid (MPNet) | -0.017848 | [-0.037829, 0.002543] | 0.084892 | 0.339566 | 175 | 228 | 245 |
| Rerank (MPNet) − Rerank (BM25) | 0.071979 | [0.057552, 0.087011] | < 0.0001 | 0.001000 | 212 | 46 | 390 |
| Rerank (Hybrid MPNet) − Rerank (MPNet) | -0.022877 | [-0.030006, -0.015679] | < 0.0001 | 0.001000 | 24 | 157 | 467 |

#### recall_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Rerank (BM25) − BM25 | 0.111487 | [0.090040, 0.133612] | < 0.0001 | 0.001000 | 169 | 26 | 453 |
| Rerank (MPNet) − MPNet | -0.095664 | [-0.120547, -0.070888] | < 0.0001 | 0.001000 | 60 | 184 | 404 |
| Rerank (Hybrid MPNet) − Hybrid (MPNet) | -0.026555 | [-0.051950, -0.001607] | 0.037896 | 0.227377 | 90 | 128 | 430 |
| Rerank (MPNet) − Rerank (BM25) | 0.092224 | [0.071997, 0.112834] | < 0.0001 | 0.001000 | 143 | 19 | 486 |
| Rerank (Hybrid MPNet) − Rerank (MPNet) | -0.023830 | [-0.035024, -0.012996] | 0.000300 | 0.002100 | 9 | 57 | 582 |

### Development-selected weights

The following weights were selected on the stated development split by the pre-specified highest-mean-nDCG@10 rule; the test comparisons above describe the resulting test evaluation and do not establish causation.

| Model | Dev split | Dev queries | Selected BM25 weight | Dev nDCG@10 by weight |
| --- | --- | ---: | ---: | --- |
| sentence-transformers/all-MiniLM-L6-v2 | dev (Hugging Face validation) | 500 | 0.1 | 0.0: 0.3881, 0.1: 0.3952, 0.2: 0.3868, 0.3: 0.3754, 0.4: 0.3573, 0.5: 0.3408, 0.6: 0.3244, 0.7: 0.3097, 0.8: 0.2930, 0.9: 0.2708, 1.0: 0.2327 |
| sentence-transformers/all-mpnet-base-v2 | dev (Hugging Face validation) | 500 | 0.0 | 0.0: 0.5272, 0.1: 0.5138, 0.2: 0.4895, 0.3: 0.4615, 0.4: 0.4351, 0.5: 0.4074, 0.6: 0.3711, 0.7: 0.3456, 0.8: 0.3206, 0.9: 0.2884, 1.0: 0.2327 |

### Hybrid (MPNet) vs BM25 and MPNet

| Outcome | Queries |
| --- | ---: |
| Hybrid beats both | 115 |
| Hybrid loses to both | 4 |
| Hybrid is between or tied | 529 |

### Error analysis: BM25 vs MPNet

The examples are illustrative, not a random sample. For each direction, the 10 examples with the largest nDCG@10 margins are selected; ties are broken by ascending query ID.

| Direction | Largest margin | Queries at largest margin | BM25 total wins | MPNet total wins |
| --- | ---: | ---: | ---: | ---: |
| bm25_over_mpnet | 1.000000 | 2 | 64 | 417 |
| mpnet_over_bm25 | 1.000000 | 35 | 64 | 417 |

| Direction | Query ID | Query | Relevant docs | nDCG@10 margin | BM25 first relevant rank | MPNet first relevant rank |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| bm25_over_mpnet | 10601 | Bitcoin Cost Basis Purchases | 1 | 1.000000 | 1 | 61 |
| bm25_over_mpnet | 5155 | For insurance, why should you refuse $4,000/year for only 10 years and prefer $500/year indefinitely? | 1 | 1.000000 | 1 | 24 |
| bm25_over_mpnet | 1310 | Is is possible to take a mortgage using Bitcoin as collateral? | 1 | 0.630930 | 2 | not in top 100 |
| bm25_over_mpnet | 7992 | What type of pension should I get? | 2 | 0.613147 | 1 | 23 |
| bm25_over_mpnet | 6849 | What do the points in a stock market index epresent? | 1 | 0.569323 | 1 | 4 |
| bm25_over_mpnet | 9737 | Long(100%)-Short(-100%) investment explanation | 3 | 0.515169 | 1 | 3 |
| bm25_over_mpnet | 1469 | Why do some companies report how well their EBITDA performed even if their overall net profit did equally well? | 1 | 0.500000 | 1 | 3 |
| bm25_over_mpnet | 8592 | Tax implications of exercising ISOs and using proceeds to exercise more ISOs | 3 | 0.469279 | 1 | 13 |
| bm25_over_mpnet | 6875 | Where to find free Thailand stock recommendations and research? | 1 | 0.430677 | 4 | not in top 100 |
| bm25_over_mpnet | 5331 | Exercises of employee share options | 1 | 0.386853 | 5 | 14 |
| mpnet_over_bm25 | 106 | What approaches are there for pricing a small business? | 1 | 1.000000 | 68 | 1 |
| mpnet_over_bm25 | 10628 | What happens with the “long” buyer of a stock when somebody else's short fails (that is, unlimited loss bankrupts short seller) | 1 | 1.000000 | 75 | 1 |
| mpnet_over_bm25 | 1074 | How common is “pass-through” health insurance? | 1 | 1.000000 | not in top 100 | 1 |
| mpnet_over_bm25 | 11088 | Am I required to have a lawyer create / oversee creation of my will? | 1 | 1.000000 | not in top 100 | 1 |
| mpnet_over_bm25 | 1230 | How does Walmart account their expired food | 1 | 1.000000 | not in top 100 | 1 |
| mpnet_over_bm25 | 1824 | Is there a way to open a U.S. bank account for my LLC remotely? | 1 | 1.000000 | not in top 100 | 1 |
| mpnet_over_bm25 | 1915 | Should I pay a company who failed to collect VAT from me over 6 months ago? | 2 | 1.000000 | 15 | 1 |
| mpnet_over_bm25 | 1948 | Which colors can one use to fill out a check in the US? | 1 | 1.000000 | not in top 100 | 1 |
| mpnet_over_bm25 | 2076 | Can vet / veterinary bills be considered deductions (tax-deductible) for Income Tax purposes [Canada]? | 2 | 1.000000 | not in top 100 | 1 |
| mpnet_over_bm25 | 2388 | Do financial advisors get better deals on mortgages? | 1 | 1.000000 | 16 | 1 |

### Error analysis: Rerank (MPNet) vs MPNet

These examples are descriptive, not causal: one hypothesis is that cross-encoder relevance scores reorder already retrieved candidates differently from the dense first stage.

| Outcome | Queries |
| --- | ---: |
| Improved | 133 |
| Unchanged | 211 |
| Degraded | 304 |

| Direction | Query ID | Query | Relevant docs | nDCG@10 margin | MPNet first relevant rank | Rerank first relevant rank |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| improves most | 10601 | Bitcoin Cost Basis Purchases | 1 | 1.000000 | 61 | 1 |
| improves most | 4775 | Should I finance a car to build credit for a mortgage next year? | 1 | 1.000000 | 28 | 1 |
| improves most | 5155 | For insurance, why should you refuse $4,000/year for only 10 years and prefer $500/year indefinitely? | 1 | 1.000000 | 24 | 1 |
| improves most | 549 | Where to request ACH Direct DEBIT of funds from MY OWN personal bank account? | 1 | 1.000000 | 44 | 1 |
| improves most | 3039 | Can increasing my tax withholding from my full-time job cover FICA taxes for my freelance work? | 1 | 0.666667 | 7 | 1 |
| improves most | 3837 | Opening a Roth IRA account, what is the fee structure for Vanguard, Scottrade and TIAA-CREF | 1 | 0.643793 | 6 | 1 |
| improves most | 5331 | Exercises of employee share options | 1 | 0.630930 | 14 | 2 |
| improves most | 8017 | Purchasing ETFs when (pretty much) everything else is maxed out | 1 | 0.630930 | 13 | 2 |
| improves most | 8874 | When can you adjust for (and re-allow) a disallowed year-end (December) wash-sale loss? | 1 | 0.630930 | 26 | 2 |
| improves most | 8592 | Tax implications of exercising ISOs and using proceeds to exercise more ISOs | 3 | 0.617320 | 13 | 1 |
| hurts most | 106 | What approaches are there for pricing a small business? | 1 | 1.000000 | 1 | 13 |
| hurts most | 10628 | What happens with the “long” buyer of a stock when somebody else's short fails (that is, unlimited loss bankrupts short seller) | 1 | 1.000000 | 1 | 28 |
| hurts most | 1230 | How does Walmart account their expired food | 1 | 1.000000 | 1 | 29 |
| hurts most | 1824 | Is there a way to open a U.S. bank account for my LLC remotely? | 1 | 1.000000 | 1 | 19 |
| hurts most | 5427 | How do auto-loan payments factor into taxes for cars that are solely used by dependent(s)? | 2 | 1.000000 | 1 | 31 |
| hurts most | 8512 | Is it possible to transfer stock I already own into my Roth IRA without having to sell the stock? | 1 | 1.000000 | 1 | 13 |
| hurts most | 853 | What will my taxes be as self employed? | 2 | 1.000000 | 1 | 30 |
| hurts most | 945 | Paid by an American company but working from France: where should I pay taxes? | 1 | 1.000000 | 1 | 37 |
| hurts most | 3394 | What is the easiest way to back-test index funds and ETFs? | 4 | 0.831872 | 1 | 33 |
| hurts most | 6959 | What is the term for the quantity (high price minus low price) for a stock? | 2 | 0.790386 | 1 | 17 |

### nDCG@10 breakdowns

#### query_length_tertiles

| Bucket | Queries | BM25 | Hybrid-tuned (MiniLM) | Hybrid-tuned (MPNet) | Hybrid (MiniLM) | Hybrid (MPNet) | Rerank (BM25) | Rerank (Hybrid MPNet) | Rerank (MPNet) | MiniLM | MPNet | TF-IDF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| short (2–9 words) | 216 | 0.192008 | 0.329666 | 0.431259 | 0.293089 | 0.361768 | 0.293825 | 0.341261 | 0.361323 | 0.318480 | 0.431259 | 0.117880 |
| medium (9–13 words) | 216 | 0.260363 | 0.404879 | 0.537693 | 0.352725 | 0.432804 | 0.374290 | 0.427400 | 0.446625 | 0.400591 | 0.537693 | 0.189110 |
| long (13–31 words) | 216 | 0.214546 | 0.389739 | 0.529945 | 0.350374 | 0.402712 | 0.328317 | 0.375079 | 0.404423 | 0.386943 | 0.529945 | 0.139339 |

#### relevant_documents

| Bucket | Queries | BM25 | Hybrid-tuned (MiniLM) | Hybrid-tuned (MPNet) | Hybrid (MiniLM) | Hybrid (MPNet) | Rerank (BM25) | Rerank (Hybrid MPNet) | Rerank (MPNet) | MiniLM | MPNet | TF-IDF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 220 | 0.233324 | 0.392787 | 0.479645 | 0.343069 | 0.400406 | 0.353418 | 0.405004 | 0.425768 | 0.388237 | 0.479645 | 0.142355 |
| 2-3 | 287 | 0.225975 | 0.356625 | 0.516838 | 0.326845 | 0.407379 | 0.323458 | 0.366168 | 0.384736 | 0.345864 | 0.516838 | 0.151335 |
| 4+ | 141 | 0.197646 | 0.383554 | 0.495798 | 0.325509 | 0.380187 | 0.316631 | 0.374869 | 0.409812 | 0.384567 | 0.495798 | 0.153587 |

Differences whose Holm-adjusted p-value is not below 0.05 are not statistically distinguishable at this bootstrap resolution. Relevant-document buckets with fewer than 20 queries are omitted: none.

## scifact

### Paired comparisons

#### ndcg_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | 0.024544 | [0.002641, 0.046183] | 0.027797 | 0.194581 | 57 | 32 | 211 |
| MiniLM − BM25 | -0.021219 | [-0.061044, 0.018407] | 0.287471 | 0.862414 | 67 | 74 | 159 |
| MPNet − BM25 | -0.010604 | [-0.050919, 0.029786] | 0.614539 | 0.862414 | 67 | 66 | 167 |
| MPNet − MiniLM | 0.010615 | [-0.015587, 0.037184] | 0.422558 | 0.862414 | 56 | 50 | 194 |
| Hybrid (MPNet) − BM25 | 0.019838 | [-0.006870, 0.046197] | 0.144286 | 0.662934 | 65 | 41 | 194 |
| Hybrid (MPNet) − MPNet | 0.030442 | [0.001772, 0.057507] | 0.032897 | 0.197380 | 73 | 37 | 190 |
| Hybrid (MiniLM) − BM25 | 0.018672 | [-0.005446, 0.043401] | 0.132587 | 0.662934 | 60 | 40 | 200 |
| Hybrid (MiniLM) − MiniLM | 0.039891 | [0.012402, 0.067223] | 0.004200 | 0.033597 | 79 | 34 | 187 |

#### recall_at_100

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | -0.012333 | [-0.025667, -0.002000] | 0.040696 | 0.162784 | 0 | 5 | 295 |
| MiniLM − BM25 | 0.045778 | [0.008111, 0.084336] | 0.020098 | 0.100490 | 28 | 11 | 261 |
| MPNet − BM25 | 0.062444 | [0.021331, 0.104444] | 0.003900 | 0.027297 | 34 | 12 | 254 |
| MPNet − MiniLM | 0.016667 | [-0.013333, 0.046667] | 0.273873 | 0.568143 | 14 | 9 | 277 |
| Hybrid (MPNet) − BM25 | 0.080778 | [0.050667, 0.112336] | < 0.0001 | 0.001600 | 29 | 1 | 270 |
| Hybrid (MPNet) − MPNet | 0.018333 | [-0.008333, 0.046667] | 0.194781 | 0.568143 | 12 | 6 | 282 |
| Hybrid (MiniLM) − BM25 | 0.075111 | [0.047000, 0.105778] | < 0.0001 | 0.001600 | 25 | 0 | 275 |
| Hybrid (MiniLM) − MiniLM | 0.029333 | [0.006667, 0.053333] | 0.016098 | 0.096590 | 11 | 3 | 286 |

### Tuned-hybrid comparisons (separate Holm family)

This separate family compares the pre-specified development-selected weighted hybrid on test queries. These adjusted p-values do not alter the earlier comparison family.

#### ndcg_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Hybrid-tuned (MiniLM) − Hybrid (MiniLM) | 0.010586 | [-0.001668, 0.023410] | 0.098590 | 0.394361 | 37 | 34 | 229 |
| Hybrid-tuned (MiniLM) − MiniLM | 0.050476 | [0.018430, 0.082583] | 0.003200 | 0.022398 | 84 | 45 | 171 |
| Hybrid-tuned (MiniLM) − BM25 | 0.029257 | [0.012194, 0.046955] | 0.001300 | 0.010399 | 58 | 18 | 224 |
| Hybrid-tuned (MPNet) − Hybrid (MPNet) | 0.004783 | [-0.005672, 0.015474] | 0.372463 | 0.744926 | 28 | 21 | 251 |
| Hybrid-tuned (MPNet) − MPNet | 0.035224 | [0.003840, 0.066249] | 0.027097 | 0.162584 | 80 | 45 | 175 |
| Hybrid-tuned (MPNet) − BM25 | 0.024620 | [0.002039, 0.047261] | 0.032297 | 0.162584 | 63 | 33 | 204 |

#### recall_at_100

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Hybrid-tuned (MiniLM) − Hybrid (MiniLM) | -0.039000 | [-0.061667, -0.019000] | 0.001300 | 0.010399 | 0 | 13 | 287 |
| Hybrid-tuned (MiniLM) − MiniLM | -0.009667 | [-0.041667, 0.023000] | 0.555644 | 1.000000 | 11 | 16 | 273 |
| Hybrid-tuned (MiniLM) − BM25 | 0.036111 | [0.016667, 0.058889] | 0.001000 | 0.008999 | 12 | 0 | 288 |
| Hybrid-tuned (MPNet) − Hybrid (MPNet) | -0.006667 | [-0.020000, 0.006667] | 0.294371 | 1.000000 | 1 | 3 | 296 |
| Hybrid-tuned (MPNet) − MPNet | 0.011667 | [-0.018333, 0.041667] | 0.452355 | 1.000000 | 13 | 9 | 278 |
| Hybrid-tuned (MPNet) − BM25 | 0.074111 | [0.046778, 0.104000] | < 0.0001 | 0.001200 | 26 | 0 | 274 |

### Reranking comparisons (separate Holm family)

This separate family is the pre-specified cross-encoder reranking comparison. Recall@100 is excluded because reranking only reorders the same 100 first-stage candidates.

#### ndcg_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Rerank (BM25) − BM25 | 0.013398 | [-0.016955, 0.044121] | 0.390061 | 1.000000 | 53 | 53 | 194 |
| Rerank (MPNet) − MPNet | 0.039075 | [0.004691, 0.074653] | 0.030997 | 0.185981 | 73 | 56 | 171 |
| Rerank (Hybrid MPNet) − Hybrid (MPNet) | 0.005158 | [-0.023792, 0.034031] | 0.730527 | 1.000000 | 59 | 60 | 181 |
| Rerank (MPNet) − Rerank (BM25) | 0.015074 | [0.000204, 0.031162] | 0.055194 | 0.275972 | 24 | 12 | 264 |
| Rerank (Hybrid MPNet) − Rerank (MPNet) | -0.003476 | [-0.012395, 0.005554] | 0.438756 | 1.000000 | 7 | 18 | 275 |

#### recall_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Rerank (BM25) − BM25 | 0.018000 | [-0.017226, 0.053779] | 0.317568 | 1.000000 | 23 | 15 | 262 |
| Rerank (MPNet) − MPNet | 0.023778 | [-0.018225, 0.064778] | 0.261174 | 1.000000 | 26 | 20 | 254 |
| Rerank (Hybrid MPNet) − Hybrid (MPNet) | -0.001500 | [-0.040278, 0.036112] | 0.940006 | 1.000000 | 19 | 20 | 261 |
| Rerank (MPNet) − Rerank (BM25) | 0.017778 | [-0.012222, 0.047778] | 0.242976 | 1.000000 | 14 | 8 | 278 |
| Rerank (Hybrid MPNet) − Rerank (MPNet) | 0.005000 | [-0.015000, 0.025000] | 0.613039 | 1.000000 | 6 | 4 | 290 |

### Development-selected weights

The following weights were selected on the stated development split by the pre-specified highest-mean-nDCG@10 rule; the test comparisons above describe the resulting test evaluation and do not establish causation.

| Model | Dev split | Dev queries | Selected BM25 weight | Dev nDCG@10 by weight |
| --- | --- | ---: | ---: | --- |
| sentence-transformers/all-MiniLM-L6-v2 | train | 809 | 0.7 | 0.0: 0.6602, 0.1: 0.6764, 0.2: 0.6848, 0.3: 0.6896, 0.4: 0.6923, 0.5: 0.6942, 0.6: 0.6996, 0.7: 0.7007, 0.8: 0.6989, 0.9: 0.6806, 1.0: 0.6680 |
| sentence-transformers/all-mpnet-base-v2 | train | 809 | 0.6 | 0.0: 0.6598, 0.1: 0.6821, 0.2: 0.6949, 0.3: 0.6981, 0.4: 0.6946, 0.5: 0.6981, 0.6: 0.7018, 0.7: 0.7006, 0.8: 0.6949, 0.9: 0.6867, 1.0: 0.6680 |

### Hybrid (MPNet) vs BM25 and MPNet

| Outcome | Queries |
| --- | ---: |
| Hybrid beats both | 24 |
| Hybrid loses to both | 1 |
| Hybrid is between or tied | 275 |

### Error analysis: BM25 vs MPNet

The examples are illustrative, not a random sample. For each direction, the 10 examples with the largest nDCG@10 margins are selected; ties are broken by ascending query ID.

| Direction | Largest margin | Queries at largest margin | BM25 total wins | MPNet total wins |
| --- | ---: | ---: | ---: | ---: |
| bm25_over_mpnet | 1.000000 | 11 | 66 | 67 |
| mpnet_over_bm25 | 1.000000 | 10 | 66 | 67 |

| Direction | Query ID | Query | Relevant docs | nDCG@10 margin | BM25 first relevant rank | MPNet first relevant rank |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| bm25_over_mpnet | 1024 | Recurrent mutations occur frequently within CTCF anchor sites adjacent to oncogenes. | 1 | 1.000000 | 1 | 64 |
| bm25_over_mpnet | 1363 | Venules have a thinner or absent smooth layer compared to arterioles. | 1 | 1.000000 | 1 | not in top 100 |
| bm25_over_mpnet | 1385 | cSMAC formation enhances weak ligand signalling. | 1 | 1.000000 | 1 | 34 |
| bm25_over_mpnet | 294 | Crossover hot spots are not found within gene promoters in Saccharomyces cerevisiae. | 1 | 1.000000 | 1 | 38 |
| bm25_over_mpnet | 587 | In transgenic mice harboring green florescent protein under the control of the Sox2 promoter, less than ten percent of the cells with green florescent colocalize with cell proliferation markers. | 1 | 1.000000 | 1 | 77 |
| bm25_over_mpnet | 659 | Ivermectin is used to treat lymphatic filariasis. | 1 | 1.000000 | 1 | 98 |
| bm25_over_mpnet | 660 | Ivermectin is used to treat onchocerciasis. | 1 | 1.000000 | 1 | not in top 100 |
| bm25_over_mpnet | 690 | Less than 10% of the gabonese children with Schimmelpenning-Feuerstein-Mims syndrome (SFM) had a plasma lactate of more than 5mmol/L. | 1 | 1.000000 | 1 | 22 |
| bm25_over_mpnet | 691 | Leukemia associated Rho guanine nucleotide-exchange factor represses RhoA in response to SRC activation. | 1 | 1.000000 | 1 | 19 |
| bm25_over_mpnet | 743 | Macrolides protect against myocardial infarction. | 1 | 1.000000 | 1 | 35 |
| mpnet_over_bm25 | 1088 | Silencing of Bcl2 is important for the maintenance and progression of tumors. | 1 | 1.000000 | not in top 100 | 1 |
| mpnet_over_bm25 | 1245 | The one-child policy has been successful in lowering population growth. | 1 | 1.000000 | 21 | 1 |
| mpnet_over_bm25 | 1278 | The treatment of cancer patients with co-IR blockade does not cause any adverse autoimmune events. | 1 | 1.000000 | not in top 100 | 1 |
| mpnet_over_bm25 | 1279 | The treatment of cancer patients with co-IR blockade precipitates adverse autoimmune events. | 1 | 1.000000 | not in top 100 | 1 |
| mpnet_over_bm25 | 1368 | Vitamin D deficiency effects the term of delivery. | 1 | 1.000000 | 40 | 1 |
| mpnet_over_bm25 | 183 | Bone marrow cells contribute to adult macrophage compartments. | 1 | 1.000000 | 11 | 1 |
| mpnet_over_bm25 | 514 | High dietary calcium intakes are unnecessary for prevention of secondary hyperparathyroidism in subjects with 25(OH)D levels above 75 nmol/liter. | 1 | 1.000000 | 14 | 1 |
| mpnet_over_bm25 | 628 | Infection of human T-cell lymphotropic virus type 1 is most frequent in individuals of African origin. | 1 | 1.000000 | 13 | 1 |
| mpnet_over_bm25 | 72 | Activator-inhibitor pairs are provided dorsally by Admpchordin. | 1 | 1.000000 | 11 | 1 |
| mpnet_over_bm25 | 800 | Modifying the epigenome in the brain affects the normal human aging process by affecting certain genes related to neurogenesis. | 1 | 1.000000 | 94 | 1 |

### Error analysis: Rerank (MPNet) vs MPNet

These examples are descriptive, not causal: one hypothesis is that cross-encoder relevance scores reorder already retrieved candidates differently from the dense first stage.

| Outcome | Queries |
| --- | ---: |
| Improved | 73 |
| Unchanged | 171 |
| Degraded | 56 |

| Direction | Query ID | Query | Relevant docs | nDCG@10 margin | MPNet first relevant rank | Rerank first relevant rank |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| improves most | 1024 | Recurrent mutations occur frequently within CTCF anchor sites adjacent to oncogenes. | 1 | 1.000000 | 64 | 1 |
| improves most | 1385 | cSMAC formation enhances weak ligand signalling. | 1 | 1.000000 | 34 | 1 |
| improves most | 1395 | p16INK4A accumulation is  linked to an abnormal wound response caused by the microinvasive step of advanced Oral Potentially Malignant Lesions (OPMLs). | 1 | 1.000000 | 13 | 1 |
| improves most | 269 | Cold exposure reduces BAT recruitment. | 1 | 1.000000 | 12 | 1 |
| improves most | 294 | Crossover hot spots are not found within gene promoters in Saccharomyces cerevisiae. | 1 | 1.000000 | 38 | 1 |
| improves most | 690 | Less than 10% of the gabonese children with Schimmelpenning-Feuerstein-Mims syndrome (SFM) had a plasma lactate of more than 5mmol/L. | 1 | 1.000000 | 22 | 1 |
| improves most | 743 | Macrolides protect against myocardial infarction. | 1 | 1.000000 | 35 | 1 |
| improves most | 845 | Neutrophil extracellular traps (NETs) are released by ANCA-stimulated neutrophils. | 1 | 0.710935 | 10 | 1 |
| improves most | 268 | Cold exposure increases BAT recruitment. | 1 | 0.684535 | 8 | 1 |
| improves most | 793 | Mitochondria are uninvolved in apoptosis. | 1 | 0.684535 | 8 | 1 |
| hurts most | 1245 | The one-child policy has been successful in lowering population growth. | 1 | 1.000000 | 1 | 15 |
| hurts most | 1278 | The treatment of cancer patients with co-IR blockade does not cause any adverse autoimmune events. | 1 | 1.000000 | 1 | 13 |
| hurts most | 1279 | The treatment of cancer patients with co-IR blockade precipitates adverse autoimmune events. | 1 | 1.000000 | 1 | 14 |
| hurts most | 70 | Activation of PPM1D suppresses p53 function. | 2 | 1.000000 | 1 | 22 |
| hurts most | 54 | AMP-activated protein kinase (AMPK) activation increases inflammation-related fibrosis in the lungs. | 1 | 0.698970 | 1 | 9 |
| hurts most | 1204 | The combination of H3K4me3 and H3K79me2 is found in quiescent hair follicle stem cells. | 1 | 0.643793 | 1 | 6 |
| hurts most | 238 | Cells undergoing methionine restriction may activate miRNAs. | 1 | 0.630930 | 2 | 27 |
| hurts most | 237 | Cells lacking clpC have a defect in sporulation efficiency in Bacillus subtilis. | 1 | 0.569323 | 1 | 4 |
| hurts most | 684 | Lack of clpC does not affect sporulation efficiency in Bacillus subtilis cells. | 1 | 0.569323 | 1 | 4 |
| hurts most | 1191 | The amount of publicly available DNA data doubles every 10 years. | 1 | 0.500000 | 3 | 15 |

### nDCG@10 breakdowns

#### query_length_tertiles

| Bucket | Queries | BM25 | Hybrid-tuned (MiniLM) | Hybrid-tuned (MPNet) | Hybrid (MiniLM) | Hybrid (MPNet) | Rerank (BM25) | Rerank (Hybrid MPNet) | Rerank (MPNet) | MiniLM | MPNet | TF-IDF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| short (4–10 words) | 100 | 0.672215 | 0.717562 | 0.698677 | 0.708550 | 0.682710 | 0.677871 | 0.684169 | 0.695758 | 0.627275 | 0.638501 | 0.645015 |
| medium (10–14 words) | 100 | 0.634288 | 0.655359 | 0.650305 | 0.643794 | 0.653034 | 0.652950 | 0.680309 | 0.672725 | 0.641810 | 0.638078 | 0.608069 |
| long (14–29 words) | 100 | 0.692401 | 0.713754 | 0.723782 | 0.702574 | 0.722672 | 0.708275 | 0.709411 | 0.715834 | 0.666160 | 0.690512 | 0.672189 |

#### relevant_documents

| Bucket | Queries | BM25 | Hybrid-tuned (MiniLM) | Hybrid-tuned (MPNet) | Hybrid (MiniLM) | Hybrid (MPNet) | Rerank (BM25) | Rerank (Hybrid MPNet) | Rerank (MPNet) | MiniLM | MPNet | TF-IDF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 277 | 0.676125 | 0.699028 | 0.695540 | 0.688224 | 0.690153 | 0.686066 | 0.697235 | 0.701945 | 0.650850 | 0.661799 | 0.654534 |

Differences whose Holm-adjusted p-value is not below 0.05 are not statistically distinguishable at this bootstrap resolution. Relevant-document buckets with fewer than 20 queries are omitted: 2-3 (18 queries), 4+ (5 queries).
For SciFact, this leaves a single relevant-document bucket.
