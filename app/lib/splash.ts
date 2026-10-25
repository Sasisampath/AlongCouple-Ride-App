// Animation-only pen paths, aligned to the approved PNG's 1448 × 1086 canvas.
// They are never used as the finished logo: the exact supplied PNG is the final
// frame. Each stroke follows a letter, not a rectangular image reveal.
export const wordmarkStrokes = [
  { letter: "a", start: 250, duration: 290, d: "M174 537 C210 507 268 494 297 522 C325 548 336 612 314 646 C295 676 247 698 204 684 C177 674 176 643 205 617 C232 596 285 583 316 588 C327 642 350 667 384 670" },
  { letter: "l", start: 520, duration: 170, d: "M397 666 C420 640 431 563 433 486 L433 398 C430 377 423 394 425 422 L427 611 C427 658 451 681 489 676" },
  { letter: "o", start: 670, duration: 210, d: "M650 525 C618 499 564 515 551 560 C534 601 552 651 596 666 C645 683 687 651 689 603 C690 566 673 534 650 525" },
  { letter: "n", start: 860, duration: 210, d: "M779 634 L776 523 C778 512 789 541 789 582 C807 541 830 512 856 515 C893 516 900 563 906 608 C911 653 932 672 967 673" },
  { letter: "g", start: 1050, duration: 300, d: "M1153 508 C1111 491 1057 508 1030 544 C1009 572 1030 606 1070 611 C1112 616 1151 588 1172 550 C1185 526 1176 510 1153 508 M1172 550 C1158 591 1128 611 1104 626 C1091 634 1094 638 1110 639 C1150 640 1179 667 1176 702 C1171 746 1115 771 1058 744" },
] as const;

export const splashTiming = (reducedMotion: boolean) => reducedMotion
  ? { reveal: 900, complete: 1050 }
  : { reveal: 2200, complete: 2400 };
