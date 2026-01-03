# BUG:

1. 有时候，切换页面后按钮的交互会卡住，无法自动发送请求，需要重新载入页面或者点击“知识推荐”才能工作 [暂时不太确定复现的条件]

# Feature:

1. 宠物交互模块
    - dashboard换装
    - 撸猫
    - [x] 气泡鼓励
3. 知识推荐功能
    8. 题库支持的标签太少（更新题库内容）
    7. "知识推荐"与题库结合
    9. dashboard的知识点也应该（把做过的练习的标签抽出来）
    5. 一键总结知识点
5. LLM 能力
    9. 对于较为复杂的问题无法给出正确答案
    9. 目前不支援图片内容爬取(http://dsa.openjudge.cn/2025dsachapter101112/D/)
    10. 不支持<svg xmlns="http://www.w3.org/2000/svg" width="1.719ex" height="1.645ex" role="img" focusable="false" viewBox="0 -705 760 727" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" style="vertical-align: -0.05ex;"><defs><path id="MJX-50-TEX-I-1D436" d="M50 252Q50 367 117 473T286 641T490 704Q580 704 633 653Q642 643 648 636T656 626L657 623Q660 623 684 649Q691 655 699 663T715 679T725 690L740 705H746Q760 705 760 698Q760 694 728 561Q692 422 692 421Q690 416 687 415T669 413H653Q647 419 647 422Q647 423 648 429T650 449T651 481Q651 552 619 605T510 659Q484 659 454 652T382 628T299 572T226 479Q194 422 175 346T156 222Q156 108 232 58Q280 24 350 24Q441 24 512 92T606 240Q610 253 612 255T628 257Q648 257 648 248Q648 243 647 239Q618 132 523 55T319 -22Q206 -22 128 53T50 252Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math"><g data-mml-node="mi"><use data-c="1D436" xlink:href="#MJX-50-TEX-I-1D436"></use></g></g></g></svg>这一类的公式的爬取