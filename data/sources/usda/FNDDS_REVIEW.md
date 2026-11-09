# FNDDS 2024-10-31 review (T136)

The downloaded FNDDS release was searched by description for generic foods and prepared dishes
relevant to Colombian eating. A row is added to `allowlist-fndds.csv` only when the FNDDS
description describes the **same** food or dish.

| Search term | FNDDS matches | Decision |
|---|---|---|
| arepa | *Arepa Dominicana* (2707828) | **Rejected**: a Dominican cornmeal cake, a different preparation from the Colombian arepa. Arepa (casera) stays a known gap. |
| plantain | Plantain, cooked, no added fat / cooked with oil / raw / chips | Accepted: cooked without fat (2709558), cooked with oil (2709559), chips (2709563) |
| patacón, tostones, maduro | none | Gap (SR Legacy has *Plantains, green, fried*, used for fried green plantain, but it is not the twice-fried patacón) |
| yuca, cassava | Cassava, cooked (2709564); Yuca fries (2709565); Casabe | Accepted: cooked and fried cassava |
| rice | Rice, white, cooked, no added fat / fat added | Accepted (2708408, 2708407) |
| queso fresco, queso blanco | *Queso Fresco* (Mexican-style) | Not added from FNDDS; the Foundation record *Cheese, queso fresco, solid* (2647442) is used as "Queso fresco (tipo mexicano)". **Not** relabeled as queso campesino or costeño (gap). |
| empanada | Empanada fruit / NFS / beef | Rejected: wheat-dough empanadas, not the Colombian fried corn empanada (gap) |
| tamal | Tamale sweet / beef / pork | Rejected: Mexican tamales differ from the Colombian tamal (gap) |
| sancocho, ajiaco, arroz con …, bean soup, lentil soup, buñuelo, arequipe, panela | none | Gaps |
| soup, chicken / vegetable | Soup, chicken; Soup, vegetable; Soup, vegetable with meat | Accepted as generic soups (2707134, 2710113, 2710116) |
| hot chocolate | Hot chocolate / cocoa made with whole or 2% milk | Accepted (2705473) |
| coffee with milk | Coffee, Latte | Accepted as "Café con leche (latte)" (2710386) |
| guava | Guava, raw; Guava paste | Accepted. Guava paste is named "Pasta de guayaba", **not** bocadillo veleño. |
| french fries | Potato, french fries, from fresh, fried | Accepted (2709458) |

Items without a match are listed in `../KNOWN_GAPS.md`.
