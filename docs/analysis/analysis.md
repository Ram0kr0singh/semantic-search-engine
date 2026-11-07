# Per-query statistical analysis

All values are calculated from the committed per-query snapshots. P-values use a two-sided centered paired bootstrap with add-one correction: resample differences centered at their observed mean; p = (count_extreme + 1) / (resamples + 1), where count_extreme is the number of null bootstrap means with absolute value at least the observed absolute mean.

## fiqa

### Paired comparisons

The available hybrid comparisons are included in the Holm correction family, so adjusted p-values for the earlier comparisons can differ from the preceding non-hybrid report.

#### ndcg_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | 0.073529 | [0.058395, 0.088683] | < 0.0001 | 0.001600 | 204 | 62 | 382 |
| MiniLM − BM25 | 0.146366 | [0.120807, 0.171598] | < 0.0001 | 0.001600 | 322 | 101 | 225 |
| MPNet − BM25 | 0.277327 | [0.250523, 0.303535] | < 0.0001 | 0.001600 | 417 | 64 | 167 |
| MPNet − MiniLM | 0.130961 | [0.111256, 0.151156] | < 0.0001 | 0.001600 | 323 | 93 | 232 |
| Hybrid (MPNet) − BM25 | 0.176789 | [0.159728, 0.193841] | < 0.0001 | 0.001600 | 376 | 24 | 248 |
| Hybrid (MPNet) − MPNet | -0.100538 | [-0.121953, -0.078770] | < 0.0001 | 0.001600 | 144 | 298 | 206 |
| Hybrid (MiniLM) − BM25 | 0.109757 | [0.094290, 0.125451] | < 0.0001 | 0.001600 | 300 | 52 | 296 |
| Hybrid (MiniLM) − MiniLM | -0.036609 | [-0.055917, -0.017247] | 0.000600 | 0.005399 | 162 | 215 | 271 |

#### recall_at_100

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | 0.046082 | [0.025288, 0.067080] | < 0.0001 | 0.001600 | 102 | 48 | 498 |
| MiniLM − BM25 | 0.192871 | [0.162705, 0.223314] | < 0.0001 | 0.001600 | 259 | 44 | 345 |
| MPNet − BM25 | 0.306506 | [0.274954, 0.337818] | < 0.0001 | 0.001600 | 335 | 16 | 297 |
| MPNet − MiniLM | 0.113635 | [0.093307, 0.134953] | < 0.0001 | 0.001600 | 172 | 17 | 459 |
| Hybrid (MPNet) − BM25 | 0.285103 | [0.256313, 0.313031] | < 0.0001 | 0.001600 | 321 | 4 | 323 |
| Hybrid (MPNet) − MPNet | -0.021403 | [-0.035751, -0.007466] | 0.003100 | 0.021698 | 21 | 64 | 563 |
| Hybrid (MiniLM) − BM25 | 0.182343 | [0.156904, 0.208090] | < 0.0001 | 0.001600 | 231 | 14 | 403 |
| Hybrid (MiniLM) − MiniLM | -0.010528 | [-0.026220, 0.005057] | 0.185681 | 0.557044 | 45 | 69 | 534 |

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

### nDCG@10 breakdowns

#### query_length_tertiles

| Bucket | Queries | BM25 | Hybrid (MiniLM) | Hybrid (MPNet) | MiniLM | MPNet | TF-IDF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| short (2–9 words) | 216 | 0.192008 | 0.293089 | 0.361768 | 0.318480 | 0.431259 | 0.117880 |
| medium (9–13 words) | 216 | 0.260363 | 0.352725 | 0.432804 | 0.400591 | 0.537693 | 0.189110 |
| long (13–31 words) | 216 | 0.214546 | 0.350374 | 0.402712 | 0.386943 | 0.529945 | 0.139339 |

#### relevant_documents

| Bucket | Queries | BM25 | Hybrid (MiniLM) | Hybrid (MPNet) | MiniLM | MPNet | TF-IDF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 220 | 0.233324 | 0.343069 | 0.400406 | 0.388237 | 0.479645 | 0.142355 |
| 2-3 | 287 | 0.225975 | 0.326845 | 0.407379 | 0.345864 | 0.516838 | 0.151335 |
| 4+ | 141 | 0.197646 | 0.325509 | 0.380187 | 0.384567 | 0.495798 | 0.153587 |

Differences whose Holm-adjusted p-value is not below 0.05 are not statistically distinguishable at this bootstrap resolution. Relevant-document buckets with fewer than 20 queries are omitted: none.

## scifact

### Paired comparisons

The available hybrid comparisons are included in the Holm correction family, so adjusted p-values for the earlier comparisons can differ from the preceding non-hybrid report.

#### ndcg_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | 0.024544 | [0.003623, 0.045994] | 0.024298 | 0.170083 | 57 | 32 | 211 |
| MiniLM − BM25 | -0.021219 | [-0.060670, 0.018457] | 0.296570 | 0.889711 | 67 | 74 | 159 |
| MPNet − BM25 | -0.010604 | [-0.052256, 0.030282] | 0.618038 | 0.889711 | 67 | 66 | 167 |
| MPNet − MiniLM | 0.010615 | [-0.015313, 0.036447] | 0.423458 | 0.889711 | 56 | 50 | 194 |
| Hybrid (MPNet) − BM25 | 0.019838 | [-0.006386, 0.046155] | 0.138686 | 0.675932 | 65 | 41 | 194 |
| Hybrid (MPNet) − MPNet | 0.030442 | [0.002506, 0.058542] | 0.034197 | 0.205179 | 73 | 37 | 190 |
| Hybrid (MiniLM) − BM25 | 0.018672 | [-0.005355, 0.043004] | 0.135186 | 0.675932 | 60 | 40 | 200 |
| Hybrid (MiniLM) − MiniLM | 0.039891 | [0.011816, 0.066146] | 0.004700 | 0.037596 | 79 | 34 | 187 |

#### recall_at_100

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | -0.012333 | [-0.025000, -0.002333] | 0.037596 | 0.150385 | 0 | 5 | 295 |
| MiniLM − BM25 | 0.045778 | [0.008444, 0.084667] | 0.017698 | 0.088491 | 28 | 11 | 261 |
| MPNet − BM25 | 0.062444 | [0.020997, 0.104333] | 0.002700 | 0.021598 | 34 | 12 | 254 |
| MPNet − MiniLM | 0.016667 | [-0.013333, 0.048333] | 0.276572 | 0.557044 | 14 | 9 | 277 |
| Hybrid (MPNet) − BM25 | 0.080778 | [0.049667, 0.113336] | < 0.0001 | 0.001600 | 29 | 1 | 270 |
| Hybrid (MPNet) − MPNet | 0.018333 | [-0.008333, 0.046667] | 0.197680 | 0.557044 | 12 | 6 | 282 |
| Hybrid (MiniLM) − BM25 | 0.075111 | [0.046778, 0.106333] | < 0.0001 | 0.001600 | 25 | 0 | 275 |
| Hybrid (MiniLM) − MiniLM | 0.029333 | [0.006667, 0.053333] | 0.013799 | 0.082792 | 11 | 3 | 286 |

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

### nDCG@10 breakdowns

#### query_length_tertiles

| Bucket | Queries | BM25 | Hybrid (MiniLM) | Hybrid (MPNet) | MiniLM | MPNet | TF-IDF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| short (4–10 words) | 100 | 0.672215 | 0.708550 | 0.682710 | 0.627275 | 0.638501 | 0.645015 |
| medium (10–14 words) | 100 | 0.634288 | 0.643794 | 0.653034 | 0.641810 | 0.638078 | 0.608069 |
| long (14–29 words) | 100 | 0.692401 | 0.702574 | 0.722672 | 0.666160 | 0.690512 | 0.672189 |

#### relevant_documents

| Bucket | Queries | BM25 | Hybrid (MiniLM) | Hybrid (MPNet) | MiniLM | MPNet | TF-IDF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 277 | 0.676125 | 0.688224 | 0.690153 | 0.650850 | 0.661799 | 0.654534 |

Differences whose Holm-adjusted p-value is not below 0.05 are not statistically distinguishable at this bootstrap resolution. Relevant-document buckets with fewer than 20 queries are omitted: 2-3 (18 queries), 4+ (5 queries).
For SciFact, this leaves a single relevant-document bucket.
