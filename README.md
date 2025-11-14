# Basic Framework

这个分支创建自@aidenlee2005在 https://github.com/LHS183019/team-project 的`main`分支上传的档案。大家可以在这个branch`development`的基础上创建自己的新分支(e.g. `development-popup`)来进行并行开发，后面再统一处理merge的问题~

下面转载了群里的一些环境设置说明和接口说明：

## 环境

在浏览器（是chrome插件框架，chrome、edge这些浏览器都可以，火狐好像也可以，safari不行）的设置就是在扩展界面打开开发者设置后添加本地扩展就可以，然后正常的话打开oj题目界面右下角就有一个悬浮窗按钮，然后右上角也会有一个点击的按钮可以跳转“学习进度”界面

![](./readme_asset/asset1.png)


## 当前`development`的进展(2025/11/14/12:11)

现在写了一个整体的框架，然后一些简单的前端设计和特别基础的交互功能已经可以实现，也可以爬取题目信息了，剩下就是一些LLM的部署、学习进度、相似题目推荐、（电子宠物）这些功能就要整合进来，以及还剩一些前端的设计需要做。

目前处理了下面三个按钮:

![](./readme_asset/asset2.png)

- **问题引导**: 按钮只在题目界面触发，返回题目信息；

- **思路提示**：只在编辑界面触发，返回题目信息&目前编辑的进度；

- **代码纠错**: 只在结果界面触发，返回题目信息&提交的代码&报错信息。

然后后续调用llm的时候就可以在这些json里面提取字段融进prompt里调用api就可以啦

我的这部分应该内容就这么多啦，后面要处理的应该就是：

1. LLM的api调用逻辑，以及api调用文本返回后的那个前端显示；
2. 学习进度收集（这个逻辑比较困难？） 以及相似题目的推荐
3. (2)这部分的前端设计（dashboard）
4. *宠物（这个要么先搁置吧感觉没啥时间？）

## 后端Json的返回格式

目前后端方面关于json的交互返回：

<details>
<summary>问题引导的返回</summary>

```json
{
  "feature": "guide",
  "pageType": "problem",
  "title": "C:文本二叉树",
  "statement": "如上图，一棵每个节点都是一个字母，且字母互不相同的二叉树，可以用以下若干行文本表示:\n\n\n\nA\n-B\n--*\n--C\n-D\n--E\n---*\n---F\n\n\n\n\n在这若干行文本中：\n\n1) 每个字母代表一个节点。该字母在文本中是第几行，就称该节点的行号是几。根在第1行\n2) 每个字母左边的'-'字符的个数代表该结点在树中的层次（树根位于第0层）\n3) 若某第 i 层的非根节点在文本中位于第n行，则其父节点必然是第 i-1 层的节点中，行号小于n,且行号与n的差最小的那个\n4) 若某文本中位于第n行的节点(层次是i) 有两个子节点，则第n+1行就是其左子节点，右子节点是n+1行以下第一个层次为i+1的节点\n5) 若某第 i 层的节点在文本中位于第n行，且其没有左子节点而有右子节点，那么它的下一行就是 i+1个'-' 字符再加上一个 '*'\n\n\n给出一棵树的文本表示法，要求输出该数的前序、后序、中序遍历结果",
  "samples": [
    {
      "input": "2\nA\n-B\n--*\n--C\n-D\n--E\n---*\n---F\n0\nA\n-B\n-C\n0",
      "output": ""
    },
    {
      "input": "ABCDEF\nCBFEDA\nBCAEFD\n\nABC\nBCA\nBAC",
      "output": ""
    }
  ],
  "currentCode": "",
  "tags": [],
  "problemId": "2721",
  "url": "http://dsa.openjudge.cn/2025dsachapter05/C/",
  "error": "",
  "_debug_source": "direct"
}
```
</details>


<details>
<summary>思路提示的返回</summary>

```json
{
  "feature": "hint",
  "pageType": "edit",
  "title": "C:文本二叉树",
  "statement": "如上图，一棵每个节点都是一个字母，且字母互不相同的二叉树，可以用以下若干行文本表示:\n\n\n\nA\n-B\n--*\n--C\n-D\n--E\n---*\n---F\n\n\n\n\n在这若干行文本中：\n\n1) 每个字母代表一个节点。该字母在文本中是第几行，就称该节点的行号是几。根在第1行\n2) 每个字母左边的'-'字符的个数代表该结点在树中的层次（树根位于第0层）\n3) 若某第 i 层的非根节点在文本中位于第n行，则其父节点必然是第 i-1 层的节点中，行号小于n,且行号与n的差最小的那个\n4) 若某文本中位于第n行的节点(层次是i) 有两个子节点，则第n+1行就是其左子节点，右子节点是n+1行以下第一个层次为i+1的节点\n5) 若某第 i 层的节点在文本中位于第n行，且其没有左子节点而有右子节点，那么它的下一行就是 i+1个'-' 字符再加上一个 '*'\n\n\n给出一棵树的文本表示法，要求输出该数的前序、后序、中序遍历结果",
  "samples": [
    {
      "input": "2\nA\n-B\n--*\n--C\n-D\n--E\n---*\n---F\n0\nA\n-B\n-C\n0",
      "output": ""
    },
    {
      "input": "ABCDEF\nCBFEDA\nBCAEFD\n\nABC\nBCA\nBAC",
      "output": ""
    }
  ],
  "currentCode": "int main(){\n...\n}",
  "tags": [],
  "problemId": "2721",
  "url": "/2025dsachapter05/C/",
  "error": "",
  "_debug_source": "direct"
}
```
</details>

<details>
<summary>代码纠错的返回</summary>

```json
{
  "feature": "fix",
  "pageType": "result",
  "title": "C:文本二叉树",
  "statement": "如上图，一棵每个节点都是一个字母，且字母互不相同的二叉树，可以用以下若干行文本表示:A-B--*--C-D--E---*---F在这若干行文本中：1) 每个字母代表一个节点。该字母在文本中是第几行，就称该节点的行号是几。根在第1行2) 每个字母左边的'-'字符的个数代表该结点在树中的层次（树根位于第0层）3) 若某第 i 层的非根节点在文本中位于第n行，则其父节点必然是第 i-1 层的节点中，行号小于n,且行号与n的差最小的那个4) 若某文本中位于第n行的节点(层次是i) 有两个子节点，则第n+1行就是其左子节点，右子节点是n+1行以下第一个层次为i+1的节点5) 若某第 i 层的节点在文本中位于第n行，且其没有左子节点而有右子节点，那么它的下一行就是 i+1个'-' 字符再加上一个 '*' 给出一棵树的文本表示法，要求输出该数的前序、后序、中序遍历结果",
  "samples": [
    {
      "input": "2\nA\n-B\n--*\n--C\n-D\n--E\n---*\n---F\n0\nA\n-B\n-C\n0",
      "output": ""
    },
    {
      "input": "ABCDEF\nCBFEDA\nBCAEFD\n\nABC\nBCA\nBAC",
      "output": ""
    }
  ],
  "currentCode": "int main(){\n...\n}",
  "tags": [],
  "problemId": "2721",
  "url": "http://dsa.openjudge.cn/2025dsachapter05/C/",
  "error": "/home/runner/temp/50833658.11533/Main.cc: In function ‘int main()’:\n/home/runner/temp/50833658.11533/Main.cc:2:1: error: expected primary-expression before ‘...’ token\n    2 | ...\n      | ^~~",
  "_debug_source": "direct"
}
```

</details>

