// ==UserScript==
// @name         学习通选择题爬取导出（修复版v3）
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  从学习通作业回顾页面提取选择题（含选项和答案），导出为JSON
// @author       You
// @match        https://*.chaoxing.com/*
// @match        https://*.xuexi.cn/*
// @match        https://*.fanya.chaoxing.com/*
// @grant        GM_setClipboard
// @grant        GM_notification
// ==/UserScript==

(function() {
    "use strict";
    console.log("[CX Scraper v3] 脚本已加载");
    if (document.readyState === "complete") {
        setTimeout(addExtractButton, 500);
    } else {
        window.addEventListener("load", function() { setTimeout(addExtractButton, 500); });
    }

    function addExtractButton() {
        var existing = document.getElementById("cx-scraper-btn");
        if (existing) existing.remove();
        var btn = document.createElement("button");
        btn.textContent = "导出选择题";
        btn.id = "cx-scraper-btn";
        btn.style.cssText = "position:fixed;top:10px;right:10px;z-index:999999;padding:10px 18px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;box-shadow:0 2px 10px rgba(0,0,0,0.3);";
        btn.onclick = extractQuestions;
        document.body.appendChild(btn);
        console.log("[CX Scraper v3] 按钮已添加");
    }

    function extractQuestions() {
        var allQuestions = [];
        var qEls = document.querySelectorAll(".questionLi, .singleQuesId, .multiQuesId");
        console.log("[CX Scraper v3] 找到 " + qEls.length + " 个题目元素");
        if (qEls.length === 0) { alert("没有找到题目元素。"); return; }
        for (var i = 0; i < qEls.length; i++) {
            try {
                var q = parseQuestion(qEls[i], i);
                if (q) allQuestions.push(q);
            } catch(e) { console.warn("[CX Scraper v3] 跳过第" + (i+1) + "题:", e); }
        }
        if (allQuestions.length === 0) { alert("未能提取到有效数据。"); return; }
        showResultDialog(allQuestions);
    }

    function parseQuestion(el, idx) {
        if (!el || !el.textContent) return null;
        var text = getQuestionText(el);
        var type = (el.textContent.indexOf("多选题") >= 0) ? "multiple" : "single";
        var options = getOptions(el);
        var answer = getAnswer(el);
        return { id: "q_" + (idx + 1), type: type, text: text || "(提取失败)", options: options, answer: answer, tags: [] };
    }

    function getQuestionText(el) {
        var qt = el.querySelector(".qtContent, .workTextWrap");
        if (qt) return cleanText(qt.textContent);
        var mn = el.querySelector(".mark_name");
        if (mn) {
            var t = mn.textContent.trim();
            t = t.replace(/^\d+[.\u3001]\s*/, "");
            t = t.replace(/\((单选题|多选题|判断题|选择题)[^)]*\)\s*/, "");
            return cleanText(t);
        }
        return "";
    }
    function getOptions(el) {
        var opts = [];
        // 精确匹配 ul.mark_letter.qtDetail > li 里的 A-E 选项
        var ul = el.querySelector("ul.mark_letter, ul.qtDetail");
        if (ul) {
            var lis = ul.querySelectorAll("li");
            for (var i = 0; i < lis.length; i++) {
                var txt = lis[i].textContent.trim();
                var m = txt.match(/^([A-E])[.\u3001\s]*(.*)/);
                if (m) {
                    opts.push({ key: m[1], text: cleanText(m[2]) });
                } else {
                    opts.push({ key: "", text: cleanText(txt) });
                }
            }
            return opts;
        }
        // 备用: 直接在所有 li 中查找
        var allLi = el.querySelectorAll("li");
        for (var i = 0; i < allLi.length; i++) {
            var txt = allLi[i].textContent.trim();
            var m = txt.match(/^([A-E])[.\u3001\s]*(.*)/);
            if (m) opts.push({ key: m[1], text: cleanText(m[2]) });
        }
        return opts;
    }

    function getAnswer(el) {
        var ans = el.querySelector(".rightAnswerContent");
        if (ans && ans.textContent.trim()) return ans.textContent.trim();
        var green = el.querySelector(".colorGreen .rightAnswerContent");
        if (green && green.textContent.trim()) return green.textContent.trim();
        return "";
    }

    function cleanText(t) {
        if (!t) return "";
        t = t.replace(/\s+/g, " ").trim();
        t = t.replace(/<[^>]+>/g, "").trim();
        return t;
    }

    function showResultDialog(questions) {
        var json = JSON.stringify(questions, null, 2);
        var overlay = document.createElement("div");
        overlay.id = "cx-overlay";
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;";
        var dialog = document.createElement("div");
        dialog.style.cssText = "background:white;border-radius:12px;padding:20px;max-width:800px;width:90%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,0.3);";
        var header = document.createElement("div");
        header.style.cssText = "margin-bottom:12px;font-size:16px;font-weight:bold;";
        header.textContent = "共提取 " + questions.length + " 道选择题";
        dialog.appendChild(header);
        var textarea = document.createElement("textarea");
        textarea.style.cssText = "width:100%;flex:1;min-height:300px;font-size:13px;font-family:monospace;padding:10px;border:1px solid #ddd;border-radius:6px;resize:vertical;";
        textarea.readOnly = true;
        textarea.value = json;
        dialog.appendChild(textarea);
        var btnRow = document.createElement("div");
        btnRow.style.cssText = "margin-top:12px;display:flex;gap:10px;justify-content:flex-end;";
        var copyBtn = createBtn("复制JSON", "#667eea", function() { copyJSON(json); });
        var downloadBtn = createBtn("下载JSON", "#28a745", function() { downloadJSON(json); });
        var closeBtn = createBtn("关闭", "#999", function() { overlay.remove(); });
        btnRow.appendChild(copyBtn); btnRow.appendChild(downloadBtn); btnRow.appendChild(closeBtn);
        dialog.appendChild(btnRow); overlay.appendChild(dialog); document.body.appendChild(overlay);
        textarea.select();
    }
    function createBtn(text, color, onClick) {
        var btn = document.createElement("button");
        btn.textContent = text;
        btn.style.cssText = "padding:8px 16px;background:" + color + ";color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;";
        btn.onclick = onClick;
        return btn;
    }

    function copyJSON(text) {
        try { GM_setClipboard(text); alert("已复制！"); }
        catch(e) {
            navigator.clipboard.writeText(text).then(function() { alert("已复制！"); })
            .catch(function() {
                document.querySelector("#cx-overlay textarea").select();
                document.execCommand("copy");
                alert("已复制！");
            });
        }
    }

    function downloadJSON(json) {
        var blob = new Blob([json], { type: "application/json;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        var ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
        a.download = "学习通选择题_" + ts + ".json";
        a.click();
        URL.revokeObjectURL(url);
        alert("下载成功！");
    }

})();
