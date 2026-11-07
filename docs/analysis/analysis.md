# Per-query statistical analysis

All values are calculated from the committed per-query snapshots. P-values use a two-sided centered paired bootstrap with add-one correction: resample differences centered at their observed mean; p = (count_extreme + 1) / (resamples + 1), where count_extreme is the number of null bootstrap means with absolute value at least the observed absolute mean.

## fiqa

### Paired comparisons

#### ndcg_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | 0.073529 | [0.058395, 0.088683] | < 0.0001 | 0.000800 | 204 | 62 | 382 |
| MiniLM − BM25 | 0.146366 | [0.120807, 0.171598] | < 0.0001 | 0.000800 | 322 | 101 | 225 |
| MPNet − BM25 | 0.277327 | [0.250523, 0.303535] | < 0.0001 | 0.000800 | 417 | 64 | 167 |
| MPNet − MiniLM | 0.130961 | [0.111256, 0.151156] | < 0.0001 | 0.000800 | 323 | 93 | 232 |

#### recall_at_100

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | 0.046082 | [0.025504, 0.066629] | < 0.0001 | 0.000800 | 102 | 48 | 498 |
| MiniLM − BM25 | 0.192871 | [0.162727, 0.223474] | < 0.0001 | 0.000800 | 259 | 44 | 345 |
| MPNet − BM25 | 0.306506 | [0.274552, 0.337621] | < 0.0001 | 0.000800 | 335 | 16 | 297 |
| MPNet − MiniLM | 0.113635 | [0.092937, 0.134509] | < 0.0001 | 0.000800 | 172 | 17 | 459 |

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

| Bucket | Queries | TF-IDF | BM25 | MiniLM | MPNet |
| --- | ---: | ---: | ---: | ---: | ---: |
| short (2–9 words) | 216 | 0.117880 | 0.192008 | 0.318480 | 0.431259 |
| medium (9–13 words) | 216 | 0.189110 | 0.260363 | 0.400591 | 0.537693 |
| long (13–31 words) | 216 | 0.139339 | 0.214546 | 0.386943 | 0.529945 |

#### relevant_documents

| Bucket | Queries | TF-IDF | BM25 | MiniLM | MPNet |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 220 | 0.142355 | 0.233324 | 0.388237 | 0.479645 |
| 2-3 | 287 | 0.151335 | 0.225975 | 0.345864 | 0.516838 |
| 4+ | 141 | 0.153587 | 0.197646 | 0.384567 | 0.495798 |

Differences whose Holm-adjusted p-value is not below 0.05 are not statistically distinguishable at this bootstrap resolution. Relevant-document buckets with fewer than 20 queries are omitted: none.

## scifact

### Paired comparisons

#### ndcg_at_10

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | 0.024544 | [0.003092, 0.046046] | 0.025197 | 0.100790 | 57 | 32 | 211 |
| MiniLM − BM25 | -0.021219 | [-0.060234, 0.017460] | 0.289971 | 0.869913 | 67 | 74 | 159 |
| MPNet − BM25 | -0.010604 | [-0.053392, 0.030512] | 0.622738 | 0.869913 | 67 | 66 | 167 |
| MPNet − MiniLM | 0.010615 | [-0.015431, 0.037066] | 0.430057 | 0.869913 | 56 | 50 | 194 |

#### recall_at_100

| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BM25 − TF-IDF | -0.012333 | [-0.025333, -0.002333] | 0.040596 | 0.081192 | 0 | 5 | 295 |
| MiniLM − BM25 | 0.045778 | [0.008444, 0.085111] | 0.019198 | 0.057594 | 28 | 11 | 261 |
| MPNet − BM25 | 0.062444 | [0.021222, 0.104667] | 0.003400 | 0.013599 | 34 | 12 | 254 |
| MPNet − MiniLM | 0.016667 | [-0.013333, 0.046667] | 0.276272 | 0.276272 | 14 | 9 | 277 |

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

| Bucket | Queries | TF-IDF | BM25 | MiniLM | MPNet |
| --- | ---: | ---: | ---: | ---: | ---: |
| short (4–10 words) | 100 | 0.645015 | 0.672215 | 0.627275 | 0.638501 |
| medium (10–14 words) | 100 | 0.608069 | 0.634288 | 0.641810 | 0.638078 |
| long (14–29 words) | 100 | 0.672189 | 0.692401 | 0.666160 | 0.690512 |

#### relevant_documents

| Bucket | Queries | TF-IDF | BM25 | MiniLM | MPNet |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 277 | 0.654534 | 0.676125 | 0.650850 | 0.661799 |

Differences whose Holm-adjusted p-value is not below 0.05 are not statistically distinguishable at this bootstrap resolution. Relevant-document buckets with fewer than 20 queries are omitted: 2-3 (18 queries), 4+ (5 queries).
For SciFact, this leaves a single relevant-document bucket.
