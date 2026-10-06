/* =====================================================================
   HITBULLSEYE — PERFORMANCE REPORT (report.html)
   Two views:
     · Test report   — one attempt, question by question
     · Progress      — every test so far (long-journey students)
   All numbers come from HBA (the analytics engine) over the student's
   question-level rows; nothing on this page is typed in by hand.
   ===================================================================== */
var HBR = (function(){
  "use strict";
  var esc = HBC.esc, pct = HBC.pct, dur = HBC.dur;
  var F = HBA.format;

  var TONE = { good:["check","Going well"], warn:["alert","Watch"], bad:["target","Fix first"], info:["info","Note"] };
  var FOCUS = { concepts:"Concepts", accuracy:"Accuracy", speed:"Time", strategy:"Test strategy", maintain:"Keep it up" };
  var TAGS = { "missed-easy":"Missed easy", rushed:"Rushed", "time-sink":"Time sink", "slow-correct":"Slow but right",
               "missed-chance":"Skipped easy", "smart-skip":"Smart skip", "tough-cracked":"Tough cracked" };
  var MIX_COLOR = { "tough-cracked":"#047857", solid:"#10a36b", "smart-skip":"#6ee7b7", "slow-right":"#f59e0b",
                    skipped:"#cbd5e1", careless:"#e0453a", rushed:"#f97316", stuck:"#991b1b",
                    "concept-gap":"#f87171", "skipped-easy":"#fda4af" };
  var VERDICT = { strong:"Strong", weak:"Weak", par:"Okay", thin:"Too few questions" };
  var TREND = { improving:"Getting better", slipping:"Getting worse", steady:"No change", new:"Too early to say" };

  /* ---------------- small builders ---------------- */
  function head(kicker, title, sub, aside){
    return '<div class="an-head"><div><span class="an-kicker">' + esc(kicker) + "</span><h2>" + esc(title) + "</h2>" +
      (sub ? "<p>" + sub + "</p>" : "") + "</div>" + (aside || "") + "</div>";
  }
  function sec(kicker, title, sub, body, aside){ return '<section class="an-sec">' + head(kicker, title, sub, aside) + body + "</section>"; }
  function tile(l, v, s){ return '<div class="an-tile"><div class="l">' + l + '</div><div class="v">' + v + "</div>" + (s ? '<div class="s">' + s + "</div>" : "") + "</div>"; }
  function edge(e){
    if(e == null) return '<span class="edge flat">—</span>';
    var cls = e >= 0.05 ? "up" : e <= -0.05 ? "down" : "flat";
    return '<span class="edge ' + cls + '">' + F.pts(e) + "</span>";
  }
  function meter(v, peer, top){
    return '<div class="an-meter">' + (v != null ? '<i style="width:' + Math.max(2, v * 100) + '%"></i>' : "") +
      (peer != null ? '<em style="left:' + peer * 100 + '%"></em>' : "") + (top != null ? '<u style="left:' + top * 100 + '%"></u>' : "") + "</div>";
  }
  function legendMeter(top){
    return '<div class="an-legend"><span><i style="background:var(--viz-you)"></i>You</span>' +
      '<span><i class="an-tk" style="background:var(--viz-peer)"></i>Other students on the same questions</span>' +
      (top ? '<span><i class="an-tk" style="background:var(--viz-top)"></i>Top 10%</span>' : "") + "</div>";
  }

  function insights(list){
    return '<div class="an-grid an-2">' + list.map(function(i, k){
      var t = TONE[i.tone];
      return '<div class="an-ins ' + i.tone + '"' + (k === 0 && list.length % 2 ? ' style="grid-column:1/-1"' : "") + '>' +
        '<span class="an-tone ' + i.tone + '">' + ico(t[0]) + t[1] + "</span><h4>" + esc(i.title) + "</h4><p>" + esc(i.detail) + "</p></div>";
    }).join("") + "</div>";
  }

  function actions(list, perTest){
    if(!list.length) return '<div class="an-card mut">No clear gaps in this data. Keep taking full tests to build a trend.</div>';
    return '<div class="an-grid an-2">' + list.map(function(a, k){
      return '<div class="an-act"><div class="n">' + (k + 1) + '</div><div class="grow">' +
        '<div class="row" style="gap:8px;flex-wrap:wrap"><span class="an-focus">' + esc(FOCUS[a.focus]) + "</span>" +
        (a.gain ? '<span class="an-gain">up to +' + F.num(a.gain, 1) + " mark" + (a.gain === 1 ? "" : "s") + (perTest ? " a test" : "") + "</span>" : "") + "</div>" +
        "<h4>" + esc(a.title) + '</h4><div class="why">' + esc(a.why) + "</div><ul>" +
        a.steps.map(function(s){ return "<li>" + ico("check") + "<span>" + esc(s) + "</span></li>"; }).join("") + "</ul></div></div>";
    }).join("") + "</div>";
  }

  function weekPlan(days, key){
    var done = {};
    try { done = JSON.parse(localStorage.getItem(key) || "{}"); } catch(e){}
    var n = days.filter(function(d){ return done[d.day]; }).length;
    return '<div class="an-card"><div class="row-b"><div><h3>Your next 7 days</h3><div class="sub">Tap a day when it is done. About ' +
      Math.round(days.reduce(function(a, d){ return a + d.minutes; }, 0) / 60 * 10) / 10 + ' hours in all.</div></div>' +
      '<div style="min-width:180px"><div class="xs mut" style="margin-bottom:5px"><b id="wkN">' + n + "</b> of 7 done</div>" +
      '<div class="an-progress"><i id="wkBar" style="width:' + (n / 7 * 100) + '%"></i></div></div></div>' +
      '<div class="an-week mt-s" data-key="' + esc(key) + '">' + days.map(function(d){
        return '<div class="an-day' + (done[d.day] ? " done" : "") + '" data-day="' + d.day + '" role="button" tabindex="0" aria-pressed="' + !!done[d.day] + '">' +
          '<span class="an-daytick">' + ico("check") + '</span><div class="d">Day ' + d.day + "</div><b>" + esc(d.title) + "</b><p>" + esc(d.task) + '</p><div class="m">' + d.minutes + " min</div></div>";
      }).join("") + "</div></div>";
  }
  function bindWeek(root){
    root.querySelectorAll(".an-week").forEach(function(w){
      var key = w.getAttribute("data-key");
      function toggle(el){
        var done = {};
        try { done = JSON.parse(localStorage.getItem(key) || "{}"); } catch(e){}
        var d = el.getAttribute("data-day");
        done[d] = !done[d];
        try { localStorage.setItem(key, JSON.stringify(done)); } catch(e){}
        el.classList.toggle("done", !!done[d]);
        el.setAttribute("aria-pressed", !!done[d]);
        var n = Object.keys(done).filter(function(k){ return done[k]; }).length;
        var c = w.closest(".an-card");
        c.querySelector("#wkN").textContent = n;
        c.querySelector("#wkBar").style.width = (n / 7 * 100) + "%";
        if(n === 7) hbeToast("All 7 days done. Take your next test and compare!", "check", 5000);
      }
      w.addEventListener("click", function(e){ var d = e.target.closest(".an-day"); if(d) toggle(d); });
      w.addEventListener("keydown", function(e){ var d = e.target.closest(".an-day"); if(d && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); toggle(d); } });
    });
  }

  function targets(list){
    return '<div class="an-card"><h3>Goals for your next test</h3><div class="sub">Set from this test, so they are within reach.</div>' +
      '<div class="mt-s">' + list.map(function(t){
        return '<div class="an-target"><div class="lbl">' + esc(t.label) + "<small>" + esc(t.why) + '</small></div><span class="now">' + esc(t.now) + "</span>" +
          ico("arrow") + '<span class="to">' + esc(t.target) + "</span></div>";
      }).join("") + "</div></div>";
  }

  function mix(m, total, title, sub){
    return '<div class="an-card"><h3>' + esc(title) + '</h3><div class="sub">' + esc(sub) + "</div>" +
      '<div class="an-stack mt-s" role="img" aria-label="Answers by what happened">' + m.map(function(x){
        var b = HBA.BEHAVIOUR[x.key];
        return '<div style="flex:' + x.count + ";background:" + MIX_COLOR[x.key] + '" tabindex="0" data-tip="' +
          esc(HBC.tipRows(b.label, [["Questions", x.count]], b.hint)) + '">' + (x.count / total >= 0.07 ? x.count : "") + "</div>";
      }).join("") + "</div>" +
      '<div class="an-mix">' + m.map(function(x){
        var b = HBA.BEHAVIOUR[x.key];
        return '<div><i style="background:' + MIX_COLOR[x.key] + '"></i><div><b>' + x.count + "</b> " + esc(b.label) + "<span>" + esc(b.hint) + "</span></div></div>";
      }).join("") + "</div></div>";
  }

  function topicRows(areas, subAreas){
    return '<div class="an-rows"><div class="an-row head"><span>Topic</span><span>Right / tried</span><span>You (bar) vs others (mark)</span><span style="text-align:right">Vs others</span></div>' +
      areas.map(function(a){
        var subs = subAreas.filter(function(s){ return s.parentId === a.id; });
        return '<details class="an-area"><summary class="an-row"><span class="nm"><span class="car">›</span><span>' + esc(a.name) +
          '</span><span class="an-verdict ' + a.verdict + '">' + VERDICT[a.verdict] + "</span></span>" +
          '<span class="num">' + a.correct + "/" + a.attempted + (a.skipped ? " · " + a.skipped + " skipped" : "") + "</span>" +
          meter(a.accuracy, a.cohortAccuracy) + edge(a.edge) + "</summary>" +
          subs.map(function(s){
            return '<div class="an-row subrow"><span class="nm"><span>' + esc(s.name) + '</span></span><span class="num">' + s.correct + "/" + s.attempted +
              (s.skipped ? " · " + s.skipped + " skipped" : "") + "</span>" + meter(s.accuracy, s.cohortAccuracy) + edge(s.edge) + "</div>";
          }).join("") + "</details>";
      }).join("") + "</div>" + legendMeter(false);
  }

  function lodRows(lods){
    return '<div class="an-rows">' + lods.map(function(l){
      return '<div class="an-row"><span class="nm"><span>' + esc(l.name) + '</span></span><span class="num">' + l.correct + "/" + l.attempted + " right</span>" +
        meter(l.accuracy, l.cohortAccuracy) + edge(l.edge) + "</div>";
    }).join("") + "</div>";
  }

  function sectionCompare(list){
    var hasBench = list.some(function(s){ return s.avg != null; });
    return '<div class="an-rows">' + list.map(function(s){
      var lead = s.avg == null ? null : s.you - s.avg;
      return '<div class="an-row"><span class="nm"><span>' + esc(s.name) + '</span></span><span class="num">' + pct(s.you) + " scored</span>" +
        meter(s.you, s.avg, s.top) + edge(lead) + "</div>";
    }).join("") + "</div>" + (hasBench ? legendMeter(true).replace("Other students on the same questions", "Average student") : "");
  }

  /* ---------------- "what this means" callout ---------------- */
  function say(lines){
    lines = lines.filter(Boolean);
    if(!lines.length) return "";
    return '<div class="an-say"><i>' + ico("info") + '</i><div><span class="an-say-l">What this means</span>' +
      lines.map(function(l){ return "<p>" + l + "</p>"; }).join("") + "</div></div>";
  }
  var B = function(s){ return "<b>" + esc(s) + "</b>"; };

  /* ---------------- question review (index fields only: no question text) ---------------- */
  var TAG_PLAIN = {
    "missed-easy": "Most students get this one right, so it is a mark you can win back",
    rushed: "Answered in under half the time others took: slow down here",
    "time-sink": "Took more than twice the usual time and still no marks",
    "slow-correct": "Right, but took more than twice the usual time",
    "missed-chance": "Left blank, though most students get it right",
    "smart-skip": "Good call: most students get this one wrong",
    "tough-cracked": "Well done: most students get this one wrong"
  };
  function review(r, rows, key){
    var byQ = {};
    rows.forEach(function(x){ byQ[x.questionId] = x; });
    var counts = {};
    r.questions.forEach(function(q){ q.tags.forEach(function(t){ counts[t] = (counts[t] || 0) + 1; }); });
    var chips = '<div class="an-filters" role="group" aria-label="Show questions">' +
      '<button class="an-chip on" data-f="">All ' + r.questions.length + "</button>" +
      '<button class="an-chip" data-f="status:wrong">Wrong ' + r.totals.wrong + "</button>" +
      '<button class="an-chip" data-f="status:skipped">Left blank ' + r.totals.skipped + "</button>" +
      Object.keys(TAGS).filter(function(t){ return counts[t]; }).map(function(t){
        return '<button class="an-chip" data-f="tag:' + t + '">' + TAGS[t] + " " + counts[t] + "</button>";
      }).join("") + "</div>";
    var list = '<div class="an-qlist">' + r.questions.map(function(q){
      var row = byQ[q.questionId] || {};
      var right = key[q.questionId];
      var label = q.status === "correct" ? "Right" : q.status === "wrong" ? "Wrong" : "Left blank";
      return '<div class="an-q" data-status="' + q.status + '" data-tags="' + q.tags.join(" ") + '">' +
        '<div class="top"><span class="qn">Question ' + q.qno + '</span><span class="an-res ' + q.status + '">' + label + "</span>" +
        "<span>" + esc(q.sectionName) + " › " + esc(q.areaTitle) + " › " + esc(q.subAreaName) + (q.lod ? " · " + esc(q.lod) : "") + "</span></div>" +
        '<div class="ans">' +
          "<span>You chose: <b>" + (row.selectedAnswer ? "Option " + esc(row.selectedAnswer) : "—") + "</b></span>" +
          (q.status !== "correct" && right ? "<span>Right option: <b>Option " + esc(right) + "</b></span>" : "") +
          "<span>Your time: <b>" + dur(q.time) + "</b>" + (q.cohortTime != null ? " (others: " + dur(q.cohortTime) + ")" : "") + "</span>" +
          (q.cohortSolveRate != null ? "<span><b>" + pct(q.cohortSolveRate) + "</b> of students got it right</span>" : "") +
        "</div>" +
        (q.tags.length ? '<div class="tagl">' + q.tags.map(function(t){ return esc(TAG_PLAIN[t]); }).join(" · ") + "</div>" : "") +
        "</div>";
    }).join("") + "</div>";
    return chips + list;
  }
  function bindReview(root, r, mountStrip){
    var box = root.querySelector(".an-filters");
    if(!box) return;
    box.addEventListener("click", function(e){
      var b = e.target.closest(".an-chip"); if(!b) return;
      box.querySelectorAll(".an-chip").forEach(function(c){ c.classList.toggle("on", c === b); });
      var f = b.getAttribute("data-f"), kind = f.split(":")[0], val = f.split(":")[1];
      root.querySelectorAll(".an-q").forEach(function(q){
        var show = !f || (kind === "status" ? q.getAttribute("data-status") === val : (" " + q.getAttribute("data-tags") + " ").indexOf(" " + val + " ") > -1);
        q.style.display = show ? "" : "none";
      });
      mountStrip(!f ? null : function(q){ return kind === "status" ? q.status === val : q.tags.indexOf(val) > -1; });
    });
  }

  /* ---------------- TEST VIEW ---------------- */
  function testView(ctx, r){
    var t = r.totals, d = r.deep, st = ctx.st;
    var rows = ctx.data.attempts.filter(function(x){ return x.testId === r.testId; });
    var rank = ctx.rank(r.testId, t.score);
    var avg = r.cohort && r.cohort.avgScore != null ? r.cohort.avgScore : null;
    var gain = d.potential.potential - t.score;
    var best = r.insights.filter(function(i){ return i.tone === "good"; })[0];
    var worst = r.insights.filter(function(i){ return i.tone === "bad"; })[0] || r.insights.filter(function(i){ return i.tone === "warn"; })[0];
    var first = r.actions[0];

    /* one-sentence verdict */
    var verdict = "You scored " + B(F.num(t.score) + " out of " + F.num(t.maxScore)) +
      (r.percentile != null ? ", better than " + B(Math.round(r.percentile) + " out of every 100") + " students who took this test." : ".") +
      (gain > 0 ? " With fewer easy mistakes it could have been " + B(F.num(d.potential.potential)) + "." : "");

    var html =
      '<section class="an-card rise"><div class="an-hero">' +
        '<div class="an-ring">' + HBC.ring(r.scorePct) + '<div class="in"><b>' + Math.round(r.scorePct * 100) + '%</b><span>Your score</span><small>' +
          F.num(t.score) + " of " + F.num(t.maxScore) + " marks</small></div></div>" +
        "<div>" +
          '<h2 style="font-size:22px">' + esc(r.testName) + '</h2><p class="sm mut">Taken on ' + esc(F.dateTime(r.takenAt)) + " · " + dur(t.time) + " in all</p>" +
          '<p class="an-verdict-line">' + verdict + "</p>" +
          '<div class="an-tiles mt-s">' +
            tile("National percentile", r.percentile != null ? Math.round(r.percentile) + "<small>%</small>" : "—", r.percentile != null ? "Better than " + Math.round(r.percentile) + " of 100 students" : "Not enough students yet") +
            tile("National rank", rank ? rank.rank + "<small> of " + rank.of + "</small>" : "—", rank ? "Everyone who took this test" : "") +
            tile("Right · wrong · blank", t.correct + '<small> · </small><span style="color:var(--err)">' + t.wrong + '</span><small> · </small><span style="color:var(--muted)">' + t.skipped + "</span>", pct(t.accuracy) + " accuracy (right out of answered)") +
            tile("Negative marks", d.potential && r.patterns.negative ? "−" + F.num(r.patterns.negative, 1) : "0", r.patterns.negative ? "Marks lost to wrong answers" : "No marks lost to wrong answers") +
            tile("Average student", avg != null ? F.num(avg, 1) + "<small> marks</small>" : "—", avg != null ? "You: " + F.signed(t.score - avg, 1) + " marks" : "") +
            tile("Top 10% benchmark", d.standing.overall.benchmark != null ? F.num(d.standing.overall.benchmark, 1) + "<small> marks</small>" : "—", d.standing.overall.topScore != null ? "Topper: " + F.num(d.standing.overall.topScore, 1) : "") +
            tile("Time per question", dur(r.avgTimePerQ), d.usualTimePerQ ? "Others took " + dur(d.usualTimePerQ) : "") +
            tile("Total time", dur(t.time), t.total + " questions") +
            tile("Could have scored", F.num(d.potential.potential) + "<small> of " + F.num(t.maxScore) + "</small>", gain > 0 ? "+" + F.num(gain) + " by fixing easy mistakes" : "No easy marks lost") +
          "</div></div></div>" +
        '<div class="an-tldr">' +
          (best ? '<div><i style="background:var(--ok-bg);color:var(--ok)">' + ico("medal") + "</i><div><span>What went well</span><b>" + esc(best.title) + "</b></div></div>" : "") +
          (worst ? '<div><i style="background:var(--err-bg);color:var(--err)">' + ico("target") + "</i><div><span>Biggest thing to fix</span><b>" + esc(worst.title) + "</b></div></div>" : "") +
          (first ? '<div><i style="background:#eaf1fc;color:#2563c9">' + ico("arrow") + "</i><div><span>Do this first" + (first.gain ? " · up to +" + F.num(first.gain, 1) + " marks" : "") + "</span><b>" + esc(first.title) + "</b></div></div>" : "") +
        "</div></section>" +
      '<div class="an-actions no-print">' +
        '<a class="an-abtn qa" href="#qwa">' + ico("list") + "<span><b>Question-wise analysis</b><small>Every question: your option, time, how others did</small></span></a>" +
        '<a class="an-abtn key" href="#" onclick="hbeToast(\'Key & Explanation opens on the main HitBullseye platform (solutions are not part of the analytics data).\',\'info\',6000);return false">' + ico("book") + "<span><b>Key & Explanation</b><small>Solutions on the main platform</small></span></a>" +
        '<a class="an-abtn rep" href="mailto:' + esc(ctx.support) + "?subject=" + encodeURIComponent("Test error: " + r.testName) + '">' + ico("alert") + "<span><b>Report test error</b><small>Tell us about a wrong question or key</small></span></a>" +
      "</div>";

    /* 1. what to do next */
    html += sec("Step 1", "What should I do next?", "Start at the top: these are ordered by how many marks they can win back.",
      actions(r.actions, false) + '<div class="mt">' + weekPlan(d.weekPlan, "hbe_plan_" + st.id + "_" + r.testId) + '</div><div class="mt">' + targets(d.targets) + "</div>");

    /* 2. what we noticed */
    html += sec("Step 2", "What did we notice in your answers?", "Each point comes from your answers, the time you spent, and how other students did on the same questions.", insights(r.insights));

    /* 3. sections */
    var secs = d.sectionCompare.slice().sort(function(a, b){ return b.you - a.you; });
    var sBest = secs[0], sWorst = secs[secs.length - 1];
    var stS = d.standing.sections, stO = d.standing.overall;
    html += sec("Step 3", "Which sections went well?", "Each card: your marks, your percentile in that section, and how your answers split. The bar compares you with the average student (grey mark) and the top 10% (dark mark).",
      '<div class="an-grid an-' + (stS.length === 4 || stS.length <= 2 ? 2 : 3) + '">' + stS.map(function(x){
        var sc = d.sectionCompare.filter(function(c){ return c.sectionId === x.id; })[0] || {};
        return '<div class="an-card an-secc"><div class="an-secc-h"><h3>' + esc(x.name) + '</h3>' + (x.percentile != null ? '<span class="an-pb ' + band(x.percentile / 100) + '">' + Math.round(x.percentile) + "%ile</span>" : "") + "</div>" +
          '<div class="an-secc-b">' + HBC.miniDonut(x.correct, x.wrong, x.skipped, 92) +
          '<div><div class="an-secc-n">' + F.num(x.score, 1) + "<small> / " + F.num(x.max) + "</small></div>" +
          '<div class="an-secc-k"><span class="ok">' + x.correct + ' right</span><span class="bad">' + x.wrong + ' wrong</span><span>' + x.skipped + " blank</span></div></div></div>" +
          meter(sc.you, sc.avg, sc.top) +
          '<div class="an-secc-f"><span>Average <b>' + (x.avgScore != null ? F.num(x.avgScore, 1) : "—") + "</b></span><span>Top 10% <b>" + (x.benchmark != null ? F.num(x.benchmark, 1) : "—") + "</b></span><span>Topper <b>" + (x.topScore != null ? F.num(x.topScore, 1) : "—") + "</b></span></div></div>";
      }).join("") + "</div>" + legendMeter(true).replace("Other students on the same questions", "Average student") +
      '<div class="an-card mt"><h3>National benchmarks</h3><div class="sub">Marks out of the maximum, for everyone who took this test.</div>' +
        '<div class="tbl-wrap" style="box-shadow:none;border:0;margin-top:10px"><table class="an-tbl"><thead><tr><th>Section</th><th>You</th><th>Your percentile</th><th>Average</th><th>Top 10%</th><th>Topper</th></tr></thead><tbody>' +
        [stO].concat(stS).map(function(x, i){
          return "<tr" + (i === 0 ? ' class="an-tot"' : "") + '><td class="nm">' + esc(x.name) + "</td><td><b>" + F.num(x.score, 1) + "</b> / " + F.num(x.max) + "</td>" +
            "<td>" + (x.percentile != null ? '<span class="an-pb ' + band(x.percentile / 100) + '">' + Math.round(x.percentile) + "%</span>" : "—") + "</td>" +
            "<td>" + (x.avgScore != null ? F.num(x.avgScore, 1) : "—") + "</td><td>" + (x.benchmark != null ? F.num(x.benchmark, 1) : "—") + "</td><td>" + (x.topScore != null ? F.num(x.topScore, 1) : "—") + "</td></tr>";
        }).join("") + "</tbody></table></div></div>" +
      say([
        sBest ? "Your best section is " + B(sBest.name) + ": you scored " + B(pct(sBest.you)) + (sBest.avg != null ? " (average student: " + pct(sBest.avg) + ")." : ".") : "",
        sWorst && sWorst !== sBest ? "Work on " + B(sWorst.name) + " first: you scored " + B(pct(sWorst.you)) + (sWorst.avg != null ? " while the average student scored " + pct(sWorst.avg) + "." : ".") : ""
      ]));

    /* 4. topics */
    var tried = r.areas.filter(function(a){ return a.attempted > 0 && a.accuracy != null; });
    var tWeak = tried.filter(function(a){ return a.verdict === "weak"; })[0] || tried.slice().sort(function(a, b){ return a.accuracy - b.accuracy; })[0];
    var tStrong = tried.filter(function(a){ return a.verdict === "strong"; })[0];
    html += sec("Step 4", "Which topics need work?", "Tap a topic to see its sub-topics. The grey mark shows how other students did on the same questions.",
      topicRows(r.areas, r.subAreas) + say([
        tWeak ? "Your weakest topic was " + B(tWeak.name) + ": " + tWeak.correct + " of " + tWeak.attempted + " right" + (tWeak.cohortAccuracy != null ? ", while other students got " + pct(tWeak.cohortAccuracy) + " right." : ".") : "",
        tStrong ? "Your strongest topic was " + B(tStrong.name) + ". Keep it warm with a little practice." : ""
      ]));

    /* 5. where the marks went */
    var by = {}; d.mix.forEach(function(m){ by[m.key] = m.count; });
    var good = (by.solid || 0) + (by["tough-cracked"] || 0) + (by["slow-right"] || 0);
    var avoid = (by.careless || 0) + (by.rushed || 0) + (by["skipped-easy"] || 0);
    var gaps = (by["concept-gap"] || 0) + (by.stuck || 0);
    html += sec("Step 5", "Where did my marks go?", "Every answer sorted by what happened, so you can see habits, not just marks.",
      '<div class="an-grid an-12">' + mix(d.mix, r.questions.length, "Your " + r.questions.length + " answers", "Hover a block to see what it means.") +
      (d.potential.steps.length
        ? '<div class="an-card"><h3>' + F.num(t.score) + " → " + F.num(d.potential.potential) + " marks</h3>" +
          '<div class="sub">Green = marks you lost on questions most students get right.</div><div class="an-chart" id="c-wf"></div></div>'
        : '<div class="an-card"><h3>No easy marks lost</h3><div class="sub">Every question most students got right, you got right too.</div>' +
          '<p class="sm mt-s">Your next marks are in the harder questions: see the topics marked <b>Weak</b> above.</p></div>') + "</div>" +
      say([
        B(good + " of " + r.questions.length) + " answers went well." + (avoid ? " " + B(String(avoid)) + " were avoidable mistakes (careless, rushed, or easy ones left blank). These are the cheapest marks to win back." : ""),
        gaps ? B(String(gaps)) + " " + (gaps === 1 ? "was a real gap" : "were real gaps") + " in understanding. Revise those topics before practising more." : ""
      ]));

    /* 6. time */
    var last = d.pacing[d.pacing.length - 1];
    var paceLine = last && last.usual != null ? (last.own <= last.usual
      ? "You finished " + B(dur(last.usual - last.own)) + " faster than other students usually take for the same questions."
      : "You took " + B(dur(last.own - last.usual)) + " longer than other students usually take for the same questions.") : "";
    var zoneNames = function(z){ return d.quadrant.filter(function(q){ return q.zone === z; }).map(function(q){ return q.name; }); };
    html += sec("Step 6", "Did I use my time well?", "The blue line is the time you had used after each question; the grey dashed line is the usual pace. Green shading = you were ahead, red = behind.",
      '<div class="an-grid an-12"><div class="an-card"><h3>Your time through the test</h3><div class="an-chart" id="c-pace"></div>' +
        '<div class="an-legend"><span><i class="line" style="background:var(--viz-you)"></i>You</span><span><i class="line" style="background:var(--viz-peer)"></i>Usual pace</span></div></div>' +
        staminaCard(d.stamina) + "</div>" +
      (d.standing.shares.length > 1 ? '<div class="an-card mt"><h3>Time spent vs score, by section</h3><div class="sub">Each column adds up to 100%. Compare how much of your time a section took with how much of your score it gave back.</div>' +
        '<div class="an-chart" id="c-share"></div><div class="an-legend">' + d.standing.shares.map(function(x, i){ return '<span><i style="background:' + HBC.CAT[i % HBC.CAT.length] + '"></i>' + esc(x.name) + "</span>"; }).join("") + "</div></div>" : "") +
      (d.quadrant.length >= 2 ? '<div class="an-card mt"><h3>Speed and accuracy, topic by topic</h3>' +
        '<div class="sub">Each dot is a topic. Higher = more answers right. Further right = slower than other students. Top-left is where you want to be.</div>' +
        '<div class="an-chart" id="c-quad"></div></div>' : "") +
      say([
        paceLine,
        zoneNames("rebuild").length ? "Slow and shaky in " + B(zoneNames("rebuild").join(", ")) + ": revise the basics there first." : "",
        zoneNames("fast-loose").length ? "Quick but making mistakes in " + B(zoneNames("fast-loose").join(", ")) + ": slow down and double-check." : "",
        zoneNames("slow-sure").length ? "Accurate but slow in " + B(zoneNames("slow-sure").join(", ")) + ": practise timed sets." : "",
        shareLine(d.standing.shares)
      ]));

    /* 7. compare */
    if(r.distribution){
      html += sec("Step 7", "How do I compare with others?", "Each bar is how many students got that score. Your bar is blue.",
        '<div class="an-card"><div class="an-chart" id="c-dist"></div><div class="an-legend"><span><i style="background:var(--viz-you)"></i>Your score</span><span><i style="background:var(--viz-peer)"></i>Other students</span></div></div>' +
        '<div class="an-card mt"><div class="row-b"><div><h3>Score vs percentile</h3><div class="sub">What each score was worth on this test. The red dot is you.</div></div>' +
          '<select class="an-sel" id="curveSel"><option value="overall">Overall</option>' + stS.map(function(x){ return '<option value="' + esc(x.id) + '">' + esc(x.name) + "</option>"; }).join("") + "</select></div>" +
          '<div class="an-chart" id="c-curve"></div></div>' +
        say([
          "You scored more than " + B(Math.round(r.percentile) + "%") + " of the " + r.distribution.students + " students on this test" + (rank ? " (rank " + rank.rank + " of " + rank.of + ")." : "."),
          "The middle score was " + B(F.num(r.distribution.median, 1)) + " and the top score " + B(F.num(r.distribution.top, 1)) + "."
        ]));
    }

    /* 8. difficulty */
    if(r.lods.length){
      var lw = r.lods.filter(function(l){ return l.edge != null && l.attempted >= 2; }).sort(function(a, b){ return a.edge - b.edge; })[0];
      var blankEasy = (r.lods.filter(function(l){ return l.id === "easy"; })[0] || {}).skipped || 0;
      var hardTried = r.lods.filter(function(l){ return /diff|hard/.test(l.id); }).reduce(function(a, l){ return a + l.attempted; }, 0);
      html += sec("Step 8", "Question selection: easy, medium, hard", "How you chose questions at each level: answered right, answered wrong, or left blank. Then your accuracy at that level against others on the same questions.",
        '<div class="an-grid an-' + Math.min(3, r.lods.length) + '">' + r.lods.map(function(l){
          return '<div class="an-card an-lod"><div class="an-secc-h"><h3>' + esc(l.name) + "</h3><span class=\"sm mut\">" + l.total + " questions</span></div>" +
            '<div class="an-secc-b">' + HBC.miniDonut(l.correct, l.wrong, l.skipped, 92) +
            '<div class="an-secc-k col"><span class="ok"><b>' + l.correct + '</b> right</span><span class="bad"><b>' + l.wrong + '</b> wrong</span><span><b>' + l.skipped + "</b> left blank</span></div></div>" +
            meter(l.accuracy, l.cohortAccuracy) + '<div class="an-secc-f"><span>Your accuracy <b>' + pct(l.accuracy) + "</b></span><span>Others <b>" + pct(l.cohortAccuracy) + "</b></span></div></div>";
        }).join("") + "</div>" + legendMeter(false) + say([
          blankEasy >= 2 && hardTried >= 2 ? "You left " + B(blankEasy + " easy") + " questions blank but attempted " + B(hardTried + " hard") + " ones. Do the easy ones first; they are the safest marks." : "",
          lw && lw.edge < -0.05 ? B(lw.name) + " questions are where you fall behind others the most (" + lw.correct + " of " + lw.attempted + " right)." :
          "You kept up with other students at every difficulty level."
        ]));
    }

    /* 9. review */
    html += '<span id="qwa"></span>' + sec("Step 9", "Question-by-question review", "Each bar is one question: its height is the time you spent, the dark line is the time other students usually took. Use the buttons to pick out a pattern.",
      '<div class="an-card"><div class="an-chart" id="c-strip"></div><div class="an-legend"><span><i style="background:var(--viz-ok)"></i>Right</span><span><i style="background:var(--viz-err)"></i>Wrong</span>' +
      '<span><i style="background:var(--viz-skip)"></i>Left blank</span><span><i class="line" style="background:var(--ink)"></i>Time others usually took</span></div></div>' +
      '<div class="mt-s">' + review(r, rows, ctx.key(r.testId)) + "</div>");

    return {
      html: html,
      after: function(root){
        if(d.potential.steps.length) HBC.mount(root.querySelector("#c-wf"), HBC.waterfall(d.potential));
        if(d.quadrant.length >= 2) HBC.mount(root.querySelector("#c-quad"), HBC.quadrant(d.quadrant, HBA.ZONES));
        HBC.mount(root.querySelector("#c-pace"), HBC.pacing(d.pacing));
        if(r.distribution) HBC.mount(root.querySelector("#c-dist"), HBC.histogram(r.distribution, t.score));
        if(d.standing.shares.length > 1) HBC.mount(root.querySelector("#c-share"), HBC.shares(d.standing.shares));
        var cEl = root.querySelector("#c-curve");
        if(cEl){
          var drawCurve = function(id){
            var x = id === "overall" ? stO : stS.filter(function(s){ return s.id === id; })[0];
            cEl.innerHTML = "";
            HBC.mount(cEl, HBC.curve(x.curve, { score: x.score, percentile: x.percentile }, "Score vs percentile: " + x.name));
          };
          drawCurve("overall");
          root.querySelector("#curveSel").addEventListener("change", function(e){ drawCurve(e.target.value); });
        }
        var stripEl = root.querySelector("#c-strip");
        var drawStrip = function(hl){ stripEl.innerHTML = ""; HBC.mount(stripEl, HBC.strip(r.questions, hl, TAGS)); };
        drawStrip(null);
        bindReview(root, r, drawStrip);
        bindWeek(root);
      }
    };
  }

  function shareLine(shares){
    var worst = shares.slice().sort(function(a, b){ return (b.time - b.score) - (a.time - a.score); })[0];
    if(!worst || worst.time - worst.score < 0.1) return "";
    return B(worst.name) + " took " + B(pct(worst.time)) + " of your time but gave " + B(pct(worst.score)) + " of your marks.";
  }

  function staminaCard(s){
    if(!s) return '<div class="an-card"><h3>Start vs finish</h3><p class="sub">Needs at least 8 questions to compare.</p></div>';
    var drop = s.drop;
    var msg = drop == null ? "Not enough answers in one half to compare." :
      drop <= -0.15 ? "You got tired towards the end. Practise full-length tests in one sitting to build stamina." :
      drop >= 0.15 ? "You started slowly and got better. A 5-minute warm-up before the test helps you start sharp." :
      "You stayed steady from start to finish. Good.";
    function h(l, x){ return '<div><div class="l">' + l + '</div><div class="v">' + pct(x.accuracy) + '</div><div class="s">' + x.correct + " of " + x.attempted + " right</div></div>"; }
    return '<div class="an-card"><h3>Start vs finish</h3><div class="sub">How many answers were right in the first half of the test and in the second half.</div>' +
      '<div class="an-halves">' + h("First half", s.first) + h("Second half", s.second) + "</div>" +
      '<p class="sm mt-s">' + esc(msg) + "</p></div>";
  }

  /* ---------------- PROGRESS VIEW ---------------- */
  function progressView(ctx, j){
    var tests = j.tests, latest = tests[tests.length - 1], first = tests[0];
    var usePct = tests.every(function(t){ return t.percentile != null; });
    var change = usePct ? latest.percentile - first.percentile : (latest.scorePct - first.scorePct) * 100;
    var simulated = HBX.hasSimulatedJourney(ctx.st.id);

    var html = (simulated ? '<div class="an-sim no-print"><div class="grow"><b>Includes 5 simulated practice mocks.</b> <span class="sm mut">Generated from your real attempt to show how the progress report works. Remove them any time.</span></div>' +
      '<button class="btn btn-ghost btn-sm" id="unsim">Remove simulated mocks</button></div>' : "") +
      '<section class="an-card rise' + (simulated ? " mt-s" : "") + '"><div class="an-hero">' +
        '<div class="an-ring">' + HBC.ring(usePct ? latest.percentile / 100 : latest.scorePct) + '<div class="in"><b>' + (usePct ? Math.round(latest.percentile) + "%" : pct(latest.scorePct)) +
          "</b><span>" + (usePct ? "Better than" : "Score") + '</span><small class="an-delta ' + (change >= 3 ? "up" : change <= -3 ? "down" : "flat") + '">' + F.signed(Math.round(change)) + " since your first test</small></div></div>" +
        '<div><h2 style="font-size:22px">Your progress across ' + tests.length + " tests</h2>" +
          '<p class="sm mut">Since ' + esc(F.date(first.takenAt, true)) + " · latest: " + esc(latest.testName) + "</p>" +
          '<p class="an-verdict-line">' + (usePct ? "In your latest test you did better than <b>" + Math.round(latest.percentile) + " out of every 100</b> students, " +
            (change >= 3 ? "up <b>" + Math.round(change) + "</b> since your first test." : change <= -3 ? "down <b>" + Math.round(-change) + "</b> since your first test." : "about the same as your first test.")
            : "Your latest score is <b>" + pct(latest.scorePct) + "</b>.") + "</p>" +
          '<div class="an-tiles mt-s">' +
            tile("Tests taken", tests.length, "latest " + F.date(latest.takenAt)) +
            tile("Questions attempted", F.num(j.questionsAttempted)) +
            tile("Time in tests", F.num(j.hoursSpent, 1) + "<small> h</small>") +
            tile("Right answers, last " + j.recent.tests + " tests", pct(j.recent.totals.accuracy), j.recent.totals.edge != null ? F.signed(Math.round(j.recent.totals.edge * 100)) + " points vs other students" : "") +
            tile("Best result", j.trends.percentile.best != null ? "Better than " + Math.round(j.trends.percentile.best) + "<small>%</small>" : "—", "of students, in one test") +
            tile("Change per test", j.trends.scorePct.slope != null ? F.signed(Math.round(j.trends.scorePct.slope * 1000) / 10, 1) + "<small>% score</small>" : "—", "average change in score from one test to the next") +
          "</div></div></div></section>";

    html += sec("Step 2", "What do all my tests say?", "Patterns across all your tests, not just the last one.", insights(j.insights));
    html += sec("Step 1", "What should I do this week?", "Built from your last " + j.recent.tests + " tests. Start at the top: these win back the most marks.", actions(j.actions, true));
    html += '<section class="an-sec">' + weekPlan(j.weekPlan, "hbe_plan_" + ctx.st.id + "_journey_" + tests.length) + "</section>";

    html += sec("Step 3", "Am I improving?", "Each dot is one test, oldest on the left (#1). The blue pill is your latest result.",
      '<div class="an-grid an-2">' +
        trendCard("Better than (percentile)", "Out of every 100 students, how many you beat", "c-tp", tests.some(function(t){ return t.percentile != null; })) +
        trendCard("Score", "Your marks as a share of full marks", "c-ts", true) +
        trendCard("Right answers", "Of the questions you answered, how many were right", "c-ta", true) +
        trendCard("Questions answered", "How much of the paper you answered", "c-tt", true) + "</div>");

    html += sec("Step 4", "Which sections are improving?", "Your score in each section, test by test.",
      '<div class="an-grid an-2">' + j.sectionTrend.map(function(s, i){
        return '<div class="an-card"><h3>' + esc(s.name) + '</h3><div class="an-chart" id="c-sec' + i + '"></div></div>';
      }).join("") + "</div>");

    html += sec("Step 5", "Which topics are getting better?", "Each box is one topic in one test: darker blue = more answers right. The last column says whether the topic is getting better or worse.",
      '<div class="an-card"><div class="an-scroll">' + heatmap(j) + "</div>" + heatLegend() + "</div>");

    html += sec("Step 6", "Are my habits improving?", "Mistakes that come from habits, not knowledge. Lower is better; the orange bar is your latest test.",
      '<div class="an-grid an-2">' +
        habitCard("Easy questions got wrong", "Questions most students get right", "c-h1") +
        habitCard("Rushed answers", "Wrong, in under half the time others take", "c-h2") +
        habitCard("Stuck questions", "More than twice the usual time, still no marks", "c-h3") +
        mix(j.recentMix, j.recentMix.reduce(function(a, x){ return a + x.count; }, 0), "How your answers went, last " + j.recent.tests + " tests", "Every recent answer by what happened.") + "</div>");

    var focus = j.recent.subAreas.filter(function(s){ return s.attempted >= 3 && s.accuracy != null && (s.verdict === "weak" || (s.edge || 0) < -0.05 || s.accuracy < 0.5); }).slice(0, 6);
    if(focus.length){
      html += sec("Step 7", "Which sub-topics should I practise?", "From your last " + j.recent.tests + " tests, weakest first.",
        '<div class="an-rows">' + focus.map(function(s){
          return '<div class="an-row"><span class="nm"><span>' + esc(s.name) + "<small>" + esc(s.parentName || "") + '</small></span></span><span class="num">' + s.correct + "/" + s.attempted + " right</span>" +
            meter(s.accuracy, s.cohortAccuracy) + edge(s.edge) + "</div>";
        }).join("") + "</div>" + legendMeter(false));
    }

    html += sec("Step 8", "All my tests", "Open any test for its full report.",
      '<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Test</th><th>Date</th><th>Score</th><th>Percentile</th><th>Accuracy</th><th>Attempted</th><th></th></tr></thead><tbody>' +
      tests.slice().reverse().map(function(t){
        var i = tests.indexOf(t);
        return "<tr><td>" + (i + 1) + '</td><td class="nm">' + esc(t.testName) + "</td><td>" + esc(F.date(t.takenAt)) + "</td><td><b>" + F.num(t.score) + "</b>/" + F.num(t.maxScore) +
          "</td><td>" + (t.percentile != null ? F.ordinal(t.percentile) : "—") + "</td><td>" + pct(t.accuracy) + "</td><td>" + pct(t.attemptRate) + "</td>" +
          '<td><a class="btn btn-ghost btn-sm" href="' + ctx.href({ test: t.testId }) + '">Report' + ico("arrow") + "</a></td></tr>";
      }).join("") + "</tbody></table></div>");

    return {
      html: html,
      after: function(root){
        var pctFmt = function(v){ return Math.round(v) + "%"; };
        var extra = function(t){ return [["Score", F.num(t.score) + " / " + F.num(t.maxScore)], ["Accuracy", pct(t.accuracy)]]; };
        var sub = function(t){ return F.date(t.takenAt, true); };
        HBC.mount(root.querySelector("#c-tp"), HBC.trend(tests, function(t){ return t.percentile; }, { max: 100, fmt: F.ordinal, label: "Percentile", extra: extra, sub: sub }));
        HBC.mount(root.querySelector("#c-ts"), HBC.trend(tests, function(t){ return t.scorePct * 100; }, { max: 100, fmt: pctFmt, label: "Score", extra: extra, sub: sub }));
        HBC.mount(root.querySelector("#c-ta"), HBC.trend(tests, function(t){ return t.accuracy == null ? null : t.accuracy * 100; }, { max: 100, fmt: pctFmt, label: "Accuracy", sub: sub }));
        HBC.mount(root.querySelector("#c-tt"), HBC.trend(tests, function(t){ return t.attemptRate * 100; }, { max: 100, fmt: pctFmt, label: "Attempted", sub: sub }));
        j.sectionTrend.forEach(function(s, i){
          HBC.mount(root.querySelector("#c-sec" + i), HBC.trend(tests, function(t, k){ return s.byTest[tests.indexOf(t)] == null ? null : s.byTest[tests.indexOf(t)] * 100; },
            { max: 100, fmt: pctFmt, label: s.name, height: 130, sub: sub }));
        });
        HBC.mount(root.querySelector("#c-h1"), HBC.bars(tests, function(t){ return t.missedEasy; }, { label: "Easy questions missed", none: "No easy question missed in any test." }));
        HBC.mount(root.querySelector("#c-h2"), HBC.bars(tests, function(t){ return t.rushed; }, { label: "Rushed answers", none: "No rushed wrong answers in any test." }));
        HBC.mount(root.querySelector("#c-h3"), HBC.bars(tests, function(t){ return t.timeSinks; }, { label: "Time sinks", none: "No time sinks in any test." }));
        bindWeek(root);
        var un = root.querySelector("#unsim");
        if(un) un.addEventListener("click", function(){ HBX.clearJourney(ctx.st.id); location.href = ctx.href({}); });
      }
    };
  }
  function trendCard(title, sub, id, show){
    return show ? '<div class="an-card"><h3>' + title + '</h3><div class="sub">' + sub + '</div><div class="an-chart" id="' + id + '"></div></div>' : "";
  }
  function habitCard(title, sub, id){ return '<div class="an-card"><h3>' + title + '</h3><div class="sub">' + sub + '</div><div class="an-chart" id="' + id + '"></div></div>'; }

  var HEAT = [[0.2, "var(--seq-1)", 0], [0.4, "var(--seq-2)", 0], [0.6, "var(--seq-3)", 1], [0.8, "var(--seq-4)", 1], [1.01, "var(--seq-5)", 1]];
  function heatStep(v){ for(var i = 0; i < HEAT.length; i++) if(v < HEAT[i][0]) return HEAT[i]; return HEAT[HEAT.length - 1]; }
  function heatmap(j){
    var n = j.tests.length, cols = "minmax(140px,1.4fr) repeat(" + n + ",minmax(34px,1fr)) 110px";
    var secs = [];
    j.areaProgress.forEach(function(a){ if(secs.indexOf(a.sectionName) < 0) secs.push(a.sectionName); });
    var html = '<div class="an-heat" style="grid-template-columns:' + cols + '"><div class="h" style="text-align:left">Topic</div>' +
      j.tests.map(function(t, i){ return '<div class="h" title="' + esc(t.testName) + '">#' + (i + 1) + "</div>"; }).join("") + '<div class="h">Trend</div>';
    secs.forEach(function(s){
      html += '<div class="sec">' + esc(s) + "</div>";
      j.areaProgress.filter(function(a){ return a.sectionName === s; }).forEach(function(a){
        html += '<div class="rh">' + esc(a.title) + "</div>";
        a.byTest.forEach(function(v, i){
          var c = a.byTestCounts[i], t = j.tests[i];
          if(v == null){ html += '<div class="c na">–</div>'; return; }
          var st = heatStep(v);
          html += '<div class="c an-mark" tabindex="0" style="background:' + st[1] + ";color:" + (st[2] ? "#fff" : "#0a1523") + (c && c.attempted === 1 ? ";opacity:.55" : "") + '" data-tip="' +
            esc(HBC.tipRows(a.title, [["Accuracy", pct(v)], ["Right", c ? c.correct + " of " + c.attempted : "—"]], t.testName)) + '">' + Math.round(v * 100) + "</div>";
        });
        html += '<div style="display:flex;align-items:center;padding-left:8px"><span class="an-trend ' + a.trend + '">' + TREND[a.trend] + "</span></div>";
      });
    });
    return html + "</div>";
  }
  function heatLegend(){
    return '<div class="an-legend"><span>Answers right</span>' + HEAT.map(function(h, i){
      return '<span><i style="background:' + h[1] + '"></i>' + (i === 0 ? "under 20%" : i === HEAT.length - 1 ? "80%+" : Math.round(HEAT[i - 1][0] * 100) + "–" + Math.round(h[0] * 100) + "%") + "</span>";
    }).join("") + '<span><i style="background:var(--line-2)"></i>not attempted</span><span>faded = only one question</span></div>';
  }

  /* ---------------- QUESTION VIEW (one-question practice: an MCQ or a coding problem) ---------------- */
  var OUTCOME = {
    right:   { label: "Right",       cls: "ok",   icon: "check" },
    wrong:   { label: "Not this time", cls: "bad", icon: "x" },
    partial: { label: "Partly right", cls: "warn", icon: "target" },
    skipped: { label: "Left blank",  cls: "mut",  icon: "info" }
  };

  function dots(rate){
    var n = Math.round(rate * 100), out = "";
    for(var i = 0; i < 100; i++) out += '<i class="' + (i < n ? "on" : "") + '"></i>';
    return '<div class="an-dots" role="img" aria-label="' + n + ' out of 100 students solve it">' + out + "</div>";
  }

  function oneQuestion(r, idx, many){
    var q = r.q, o = OUTCOME[r.outcome], d = r.difficulty, t = r.time, h = r.history;
    var head = r.insights[0];
    var kindChip = '<span class="an-kind">' + (r.kind === "coding" ? "Coding" : r.kind === "mcq" ? "MCQ" : "Question") + "</span>";
    var html = (many ? '<h2 class="an-qhead">Question ' + q.qno + "</h2>" : "") +
      '<section class="an-card rise"><div class="an-hero">' +
        '<div class="an-ring an-out ' + o.cls + '">' + HBC.ring(r.outcome === "skipped" ? 0 : r.scoreShare) +
          '<div class="in"><b>' + (r.kind === "mcq" ? ico(o.icon) : Math.round(r.scoreShare * 100) + "%") + "</b><span>" + esc(o.label) + "</span>" +
          '<small>' + F.num(q.score, 1) + " of " + F.num(q.marks) + (q.marks === 1 ? " mark" : " marks") + "</small></div></div>" +
        "<div>" +
          '<div class="row" style="gap:8px;flex-wrap:wrap">' + kindChip + '<span class="an-kind lt">' + esc(q.lod || "") + '</span><span class="sm mut">' +
            esc(q.sectionName) + " › " + esc(q.areaTitle) + " › " + esc(q.subAreaName) + "</span></div>" +
          '<h2 style="font-size:22px;margin-top:8px">' + esc(r.testName) + '</h2><p class="sm mut">Taken on ' + esc(F.dateTime(r.takenAt)) + "</p>" +
          (head ? '<p class="an-verdict-line"><b>' + esc(head.title) + ".</b> " + esc(head.detail) + "</p>" : "") +
          '<div class="an-tiles mt-s">' +
            tile("Students who solve it", d ? Math.round(d.solveRate * 100) + "<small> of 100</small>" : "—", d ? d.label : "Not enough students yet") +
            tile("Your time", dur(t.you), t.usual ? "Others usually take " + dur(t.usual) : "") +
            tile(r.outcome === "right" ? "Faster than" : "Students who got it right took", r.outcome === "right"
                ? (t.fasterThan != null ? Math.round(t.fasterThan * 100) + "<small>% of students</small>" : "—")
                : (t.medianRight != null ? dur(t.medianRight) : "—"), r.outcome === "right" ? "who answered it" : "about this long") +
            tile("Your record in " + esc(h.subAreaName), h.attempts ? h.correct + "<small> of " + h.attempts + " right</small>" : "—",
                h.othersAccuracy != null ? "Others: " + pct(h.othersAccuracy) + " right" : "") +
          "</div></div></div></section>";

    html += sec("Step 1", "What should I do next?", "Based on this answer and your record in this topic.", actions(r.actions, false));
    html += sec("Step 2", "What did we notice?", "From your answer, the time you took, and how every other student did on this same question.", insights(r.insights));

    if(d){
      html += sec("Step 3", "How hard was this question?", "Out of every 100 students who opened this question, the green dots solved it fully.",
        '<div class="an-card an-diff">' + dots(d.solveRate) + '<div><div class="an-diff-n">' + Math.round(d.solveRate * 100) + '<small> of 100</small></div>' +
        "<p><b>" + esc(d.label) + ".</b> Based on " + F.num(d.students) + " students who saw this question.</p>" +
        '<p class="sm mut">Marked <b>' + esc(q.lod || "—") + "</b> by the question setters.</p></div></div>");
    }

    if(r.options){
      var mine = r.options.filter(function(x){ return x.isYours; })[0], right = r.options.filter(function(x){ return x.isRight; })[0];
      var topWrong = r.options.filter(function(x){ return !x.isRight; }).sort(function(a, b){ return b.share - a.share; })[0];
      html += sec("Step 4", "Which answers did students pick?", "Among students who answered. The green bar is the right option; your choice is marked.",
        '<div class="an-card"><div class="an-opts">' + r.options.map(function(x){
          return '<div class="an-opt' + (x.isRight ? " right" : "") + (x.isYours ? " yours" : "") + '"><span class="l">Option ' + esc(x.letter) +
            (x.isRight ? ' <em class="tg ok">Right</em>' : "") + (x.isYours ? ' <em class="tg you">You</em>' : "") + "</span>" +
            '<div class="b"><i style="width:' + Math.max(1.5, x.share * 100) + '%"></i></div><b>' + pct(x.share) + "</b></div>";
        }).join("") + "</div></div>" +
        say([
          d && d.attemptRate != null && d.attemptRate < 0.9 ? "Only " + B(pct(d.attemptRate)) + " of students who opened this question answered it; the rest left it blank. The bars show how those who answered split." : "",
          right ? B(pct(right.share)) + " of those who answered picked the right option, " + B(right.letter) + "." : "",
          topWrong && topWrong.share >= 0.15 ? "The most common wrong answer was option " + B(topWrong.letter) + " (" + pct(topWrong.share) + "). " +
            (mine && mine.letter === topWrong.letter ? "You fell for the same trap: find the step it comes from." : "It is the trap to watch for in questions like this.") : ""
        ]));
    }
    if(r.marks){
      html += sec("Step 4", "How did everyone score?", "Marks every student earned on this question. Green = full marks; blue = you.",
        '<div class="an-card"><div class="an-chart" id="c-ms' + idx + '"></div></div>' +
        say([
          r.outcome === "right" ? "You earned full marks, like " + B(Math.round(r.marks.full * 100) + "%") + " of the students who attempted it."
            : r.marks.beat != null ? "You scored more than " + B(Math.round(r.marks.beat * 100) + "%") + " of the students who attempted it; " + B(Math.round(r.marks.full * 100) + "%") + " of them earned full marks." : "",
          r.outcome === "partial" ? "The marks you missed usually sit in edge cases: empty input, a single item, negative numbers, duplicates." : "",
          d ? "Counting everyone who opened it, including those who skipped, " + B(Math.round(d.solveRate * 100) + " out of 100") + " solved it fully." : ""
        ]));
    }

    if(t.bands.length){
      var ok = t.bands.filter(function(b){ return b.attempts >= 5; });
      var best = ok.slice().sort(function(a, b){ return b.right / b.attempts - a.right / a.attempts; })[0];
      html += sec("Step 5", "Did taking more time help?", "Each column is a group of students by how long they took. Green = got it right, red = got it wrong. The percentage is how many in that group got it right.",
        '<div class="an-card"><div class="an-chart" id="c-tb' + idx + '"></div>' +
        '<div class="an-legend"><span><i style="background:var(--viz-ok)"></i>Right</span><span><i style="background:var(--viz-err)"></i>Wrong</span><span><i class="line" style="background:var(--viz-you)"></i>Your time</span></div></div>' +
        say([
          best ? "Students who took " + B(dur(best.from) + "–" + dur(best.to)) + " did best: " + B(pct(best.right / best.attempts)) + " of them got it right (" + best.attempts + " students)." : "",
          r.outcome !== "skipped" ? "You took " + B(dur(t.you)) + (t.medianRight ? "; students who got it right usually took about " + B(dur(t.medianRight)) + "." : ".") : ""
        ]));
    }

    html += sec("Step 6", "How am I doing in " + h.subAreaName + "?", "Every " + esc(h.subAreaName) + " question you have answered, in tests and practice. Newest on the right.",
      '<div class="an-grid an-12"><div class="an-card"><h3>' + (h.recent.length === 1 ? "Your answer so far" : "Your last " + h.recent.length + " answers") + "</h3>" +
        '<div class="an-chips">' + h.recent.map(function(x){
          return '<span class="an-chipr ' + x.status + '" tabindex="0" data-tip="' + esc(HBC.tipRows(x.testName, [["Result", x.status === "correct" ? "Right" : x.status === "wrong" ? "Wrong" : "Left blank"]], F.date(x.at, true))) + '">' +
            (x.status === "correct" ? "✓" : x.status === "wrong" ? "✗" : "–") + "</span>";
        }).join("") + "</div>" +
        '<div class="mt-s">' + meter(h.accuracy, h.othersAccuracy) + "</div>" + legendMeter(false) + "</div>" +
        '<div class="an-card"><h3>Topic summary</h3>' +
          '<div class="an-target"><div class="lbl">' + esc(h.subAreaName) + "<small>this sub-topic</small></div><span class=\"now\"></span><span></span><span class=\"to\">" + (h.accuracy != null ? pct(h.accuracy) : "—") + "</span></div>" +
          '<div class="an-target"><div class="lbl">' + esc(h.areaTitle) + "<small>" + h.areaAttempts + " answers in the whole topic</small></div><span class=\"now\"></span><span></span><span class=\"to\">" + (h.areaAccuracy != null ? pct(h.areaAccuracy) : "—") + "</span></div>" +
          (r.previous ? '<div class="an-target"><div class="lbl">This question before<small>' + esc(r.previous.testName) + " · " + esc(F.date(r.previous.at)) + '</small></div><span class="now"></span><span></span><span class="to">' +
            (r.previous.status === "correct" ? "Right" : r.previous.status === "wrong" ? "Wrong" : "Blank") + "</span></div>" : "") +
        "</div></div>" +
      say([
        h.attempts >= 3 && h.accuracy != null ? "You get " + B(pct(h.accuracy)) + " of " + esc(h.subAreaName) + " questions right" +
          (h.othersAccuracy != null ? ", against " + B(pct(h.othersAccuracy)) + " for other students on the same questions." : ".") : "A few more " + esc(h.subAreaName) + " questions will show a clear pattern."
      ]));

    var maxQ = Math.max.apply(null, r.activity.map(function(a){ return a.questions; }).concat([1]));
    var active = r.activity.filter(function(a){ return a.questions; }).length;
    html += sec("Step 7", "Am I practising regularly?", "Each square is a day in the last two weeks; darker = more questions answered.",
      '<div class="an-card"><div class="an-cal">' + r.activity.map(function(a){
        var lv = a.questions ? Math.min(4, Math.ceil(a.questions / maxQ * 4)) : 0;
        var dt = new Date(a.day + "T12:00:00");
        return '<div class="an-day2 l' + lv + '" tabindex="0" data-tip="' + esc(HBC.tipRows(dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }), [["Questions", a.questions]])) + '">' +
          "<span>" + dt.toLocaleDateString("en-IN", { weekday: "narrow" }) + "</span></div>";
      }).join("") + "</div>" +
      '<p class="sm mt-s"><b>' + active + " of 14 days</b> with practice. " + (active >= 8 ? "Great rhythm, keep it up." : "Aim for a little every day; even one question keeps the habit.") + "</p></div>");

    return html;
  }

  function questionView(ctx, m){
    var many = m.questions.length > 1;
    var html = (many ? '<section class="an-card rise"><h2 style="font-size:22px">' + esc(m.testName) + '</h2><p class="sm mut">' + m.questions.length +
      " questions · " + F.num(m.score) + " of " + F.num(m.maxScore) + " marks</p></section>" : "") +
      m.questions.map(function(r, i){ return oneQuestion(r, i, many); }).join('<div class="an-sep"></div>');
    return {
      html: html,
      after: function(root){
        m.questions.forEach(function(r, i){
          if(r.marks) HBC.mount(root.querySelector("#c-ms" + i), HBC.marksSpread(r.marks.bins, r.outcome === "skipped" ? null : Math.round(Math.max(0, r.q.score) * 10) / 10, r.q.marks));
          if(r.time.bands.length) HBC.mount(root.querySelector("#c-tb" + i), HBC.timeBands(r.time.bands, r.outcome === "skipped" ? null : r.time.you));
        });
      }
    };
  }

  /* ---------------- OVERVIEW: the analytics hub across every test ---------------- */
  var STATUS = {
    strength:     { label: "Strength", cls: "ok",   icon: "medal" },
    average:      { label: "Average",  cls: "warn", icon: "target" },
    weak:         { label: "Weak",     cls: "bad",  icon: "alert" },
    insufficient: { label: "Too few questions", cls: "mut", icon: "info" }
  };
  function band(v){ return v == null ? "na" : v >= 0.8 ? "vg" : v >= 0.6 ? "g" : v >= 0.4 ? "avg" : "imp"; }
  var GROUP_LABEL = { "Assessments": "Campus assessments", "Placement Practice Series": "Practice mocks", "Quick practice": "Quick practice" };

  function overviewView(ctx, ov){
    var o = ov.overall;
    var groups = ov.groups.slice().sort(function(a, b){ return Object.keys(GROUP_LABEL).indexOf(a.name) - Object.keys(GROUP_LABEL).indexOf(b.name); });
    var totalTaken = ov.tests.length, totalAvail = 0;
    Object.keys(ctx.catalogue).forEach(function(k){ totalAvail += ctx.catalogue[k]; });

    /* sub-topics when there is enough data at that level, else whole topics */
    var rated = function(rs){ return rs.filter(function(r){ return r.status !== "insufficient"; }).length; };
    var useSub = rated(ov.subAreas) >= 3 || rated(ov.subAreas) >= rated(ov.areas);
    var lists = { strength: [], average: [], weak: [] };
    (useSub ? ov.subAreas : ov.areas).forEach(function(r){ if(lists[r.status]) lists[r.status].push(r); });

    var html =
      '<section class="an-card rise"><div class="row-b"><div><h2 style="font-size:22px">Your test analytics</h2>' +
        '<p class="sm mut">Everything you have attempted so far: ' + totalTaken + " test" + (totalTaken === 1 ? "" : "s") + ", " +
        F.num(ov.subAreas.reduce(function(a, r){ return a + r.attempted; }, 0)) + " questions answered.</p></div></div>" +
        '<div class="an-gauges">' +
          gaugeCard("Average percentile", o.avgPercentile, "Across your " + o.taken + " full test" + (o.taken === 1 ? "" : "s"), function(v){ return Math.round(v) + "%"; }) +
          gaugeCard("Median percentile", o.medianPercentile, "Your typical test (half above, half below)", function(v){ return Math.round(v) + "%"; }) +
          gaugeCard("Accuracy", o.accuracy == null ? null : o.accuracy * 100, "Right answers out of those you answered", function(v){ return Math.round(v) + "%"; }) +
        "</div>" +
        '<div class="an-legend" style="justify-content:center">' + HBC.BANDS.map(function(b){ return '<span><i style="background:' + b[2] + '"></i>' + b[3] + " (" + b[0] + "–" + b[1] + ")</span>"; }).join("") + "</div>" +
      "</section>";

    /* tests by type: taken / not taken, average & median percentile, accuracy */
    var keys = Object.keys(ctx.catalogue);
    html += sec("Tests", "Tests taken by type", "How many of the tests open to you you have taken, and how you did in each kind.",
      '<div class="an-grid an-3">' + keys.map(function(k){
        var g = groups.filter(function(x){ return x.name === k; })[0] || { taken: 0, avgPercentile: null, medianPercentile: null, accuracy: null };
        var notTaken = Math.max(0, ctx.catalogue[k] - g.taken);
        return '<div class="an-card an-type"><div class="an-type-h"><b>' + esc(GROUP_LABEL[k] || k) + '</b><span>Taken <b>' + g.taken + "</b> · Not taken <b>" + notTaken + "</b></span></div>" +
          '<div class="an-type-g">' + HBC.gauge(g.avgPercentile, { width: 200, big: 20, label: "Average percentile", fmt: function(v){ return Math.round(v) + "%"; } }) + "</div>" +
          '<div class="an-type-s"><div><span>Average %ile</span><b>' + (g.avgPercentile != null ? Math.round(g.avgPercentile) + "%" : "—") + "</b></div>" +
          "<div><span>Median %ile</span><b>" + (g.medianPercentile != null ? Math.round(g.medianPercentile) + "%" : "—") + "</b></div>" +
          "<div><span>Accuracy</span><b>" + pct(g.accuracy) + "</b></div></div>" +
          '<div class="an-progress mt-s" title="' + g.taken + " of " + ctx.catalogue[k] + ' taken"><i style="width:' + (ctx.catalogue[k] ? g.taken / ctx.catalogue[k] * 100 : 0) + '%;background:var(--viz-you)"></i></div>' +
          "</div>";
      }).join("") + "</div>");

    /* strength / average / weak */
    html += sec("Strengths", "My areas of strength and weakness", (useSub ? "Sub-topics" : "Topics") + " with at least " + HBA.CUMULATIVE_MIN + " questions answered, across all your tests and practice.",
      '<div class="an-grid an-3">' + ["strength", "average", "weak"].map(function(k){
        var st = STATUS[k], l = lists[k];
        return '<div class="an-sw ' + st.cls + '"><div class="an-sw-h">' + ico(st.icon) + "<b>" + (k === "strength" ? "Strong" : k === "average" ? "Average" : "Needs work") + "</b><span>" + l.length + "</span></div>" +
          (l.length ? '<div class="an-sw-l">' + l.map(function(r){ return '<span title="' + esc((r.parentName || "") + ": " + r.correct + " of " + r.attempted + " right") + '">' + esc(r.name) + "</span>"; }).join("") + "</div>"
                    : '<p class="sm mut">None yet.</p>') + "</div>";
      }).join("") + "</div>");

    /* cumulative table */
    html += sec("Topic table", "Strength and weakness, topic by topic", "Every topic you have met. Viewed = questions you saw; attempted = questions you answered.",
      '<div class="an-card"><div class="an-tools">' +
        '<div class="an-seg" role="group" aria-label="Level"><button' + (useSub ? ' class="on"' : "") + ' data-lv="sub">Sub-topics</button><button' + (useSub ? "" : ' class="on"') + ' data-lv="area">Topics</button></div>' +
        '<input type="search" class="an-search" id="cumQ" placeholder="Search a topic">' +
        '<select id="cumF" class="an-sel"><option value="">All statuses</option><option value="strength">Strength</option><option value="average">Average</option><option value="weak">Weak</option><option value="insufficient">Too few questions</option></select>' +
      '</div><div id="cumT"></div><div class="an-pager" id="cumP"></div>' +
      '<div class="an-legend"><span><i class="cell vg"></i>Very good (80%+)</span><span><i class="cell g"></i>Good (60–80%)</span><span><i class="cell avg"></i>Average (40–60%)</span><span><i class="cell imp"></i>Improve (under 40%)</span><span><i class="cell na"></i>Too few questions</span></div></div>');

    /* all tests */
    html += sec("All tests", "All my tests", "Search, sort or filter, then open any test for its full report.",
      '<div class="an-card"><div class="an-tools">' +
        '<input type="search" class="an-search" id="tstQ" placeholder="Search by test name">' +
        '<select id="tstS" class="an-sel"><option value="new">Recent to oldest</option><option value="old">Oldest to recent</option><option value="az">A to Z</option><option value="za">Z to A</option><option value="pct">Best percentile</option></select>' +
        '<select id="tstG" class="an-sel"><option value="">All types</option>' + keys.map(function(k){ return '<option value="' + esc(k) + '">' + esc(GROUP_LABEL[k] || k) + "</option>"; }).join("") + "</select>" +
      '</div><div class="tbl-wrap" style="box-shadow:none;border:0"><table class="an-tbl"><thead><tr><th>Test</th><th>Type</th><th>Taken</th><th>Score</th><th>Percentile</th><th>Accuracy</th><th></th></tr></thead><tbody id="tstB"></tbody></table></div></div>');

    return {
      html: html,
      after: function(root){
        /* cumulative table: level, search, status filter, 10 per page */
        var lv = useSub ? "sub" : "area", page = 0;
        function drawCum(){
          var q = root.querySelector("#cumQ").value.trim().toLowerCase(), f = root.querySelector("#cumF").value;
          var rows = (lv === "sub" ? ov.subAreas : ov.areas).filter(function(r){
            return (!f || r.status === f) && (!q || (r.name + " " + (r.parentName || "")).toLowerCase().indexOf(q) > -1);
          });
          var pages = Math.max(1, Math.ceil(rows.length / 10)); page = Math.min(page, pages - 1);
          root.querySelector("#cumT").innerHTML = '<div class="an-cum"><div class="an-cum-r h"><span>Topic</span><span>Status</span><span>Viewed / attempted</span><span>% attempted</span><span>% accuracy</span><span>Others</span></div>' +
            (rows.slice(page * 10, page * 10 + 10).map(function(r){
              var st = STATUS[r.status], thin = r.status === "insufficient";
              return '<div class="an-cum-r"><span class="nm">' + esc(r.name) + (r.parentName ? "<small>" + esc(r.parentName) + "</small>" : "") + "</span>" +
                '<span><em class="an-st ' + st.cls + '">' + ico(st.icon) + st.label + "</em></span>" +
                '<span><i class="cell info">' + r.viewed + " / " + r.attempted + "</i></span>" +
                '<span><i class="cell ' + (thin ? "na" : band(r.attemptRate)) + '">' + Math.round(r.attemptRate * 100) + "</i></span>" +
                '<span><i class="cell ' + (thin ? "na" : band(r.accuracy)) + '">' + (r.accuracy == null ? "—" : Math.round(r.accuracy * 100)) + "</i></span>" +
                '<span class="mut sm">' + (r.othersAccuracy == null ? "—" : Math.round(r.othersAccuracy * 100) + "%") + "</span></div>";
            }).join("") || '<p class="sm mut" style="padding:16px">No topics match.</p>') + "</div>";
          root.querySelector("#cumP").innerHTML = '<span class="sm mut">Page ' + (page + 1) + " of " + pages + " · " + rows.length + " topics</span>" +
            '<button class="btn btn-ghost btn-sm" data-pg="-1"' + (page ? "" : " disabled") + ">" + ico("back") + '</button><button class="btn btn-ghost btn-sm" data-pg="1"' + (page < pages - 1 ? "" : " disabled") + ">" + ico("arrow") + "</button>";
        }
        root.querySelector(".an-seg").addEventListener("click", function(e){
          var b = e.target.closest("button"); if(!b) return;
          lv = b.getAttribute("data-lv"); page = 0;
          root.querySelectorAll(".an-seg button").forEach(function(x){ x.classList.toggle("on", x === b); });
          drawCum();
        });
        root.querySelector("#cumQ").addEventListener("input", function(){ page = 0; drawCum(); });
        root.querySelector("#cumF").addEventListener("change", function(){ page = 0; drawCum(); });
        root.querySelector("#cumP").addEventListener("click", function(e){ var b = e.target.closest("[data-pg]"); if(b){ page += +b.getAttribute("data-pg"); drawCum(); } });
        drawCum();

        /* all tests: search, sort, type */
        function drawTests(){
          var q = root.querySelector("#tstQ").value.trim().toLowerCase(), s = root.querySelector("#tstS").value, g = root.querySelector("#tstG").value;
          var list = ov.tests.filter(function(t){ return (!g || t.group === g) && (!q || t.testName.toLowerCase().indexOf(q) > -1); });
          list.sort(function(a, b){
            return s === "old" ? (a.takenAt || "").localeCompare(b.takenAt || "") : s === "az" ? a.testName.localeCompare(b.testName)
              : s === "za" ? b.testName.localeCompare(a.testName) : s === "pct" ? (b.percentile || -1) - (a.percentile || -1) : (b.takenAt || "").localeCompare(a.takenAt || "");
          });
          root.querySelector("#tstB").innerHTML = list.map(function(t){
            var p = t.percentile;
            return '<tr><td class="nm">' + esc(t.testName) + '</td><td><span class="an-kind lt">' + esc(GROUP_LABEL[t.group] || t.group) + "</span></td><td>" + esc(F.date(t.takenAt)) + "</td>" +
              "<td><b>" + F.num(t.score, 1) + "</b> / " + F.num(t.maxScore) + "</td>" +
              '<td>' + (p == null ? '<span class="mut">—</span>' : '<span class="an-pb ' + band(p / 100) + '">' + Math.round(p) + "%</span>") + "</td>" +
              "<td>" + pct(t.accuracy) + '</td><td><a class="btn btn-ghost btn-sm" href="' + ctx.href({ test: t.testId }) + '">Report' + ico("arrow") + "</a></td></tr>";
          }).join("") || '<tr><td colspan="7" class="mut" style="text-align:center;padding:20px">No tests match.</td></tr>';
        }
        ["#tstQ", "#tstS", "#tstG"].forEach(function(id){ root.querySelector(id).addEventListener(id === "#tstQ" ? "input" : "change", drawTests); });
        drawTests();
      }
    };
  }

  function gaugeCard(title, v, sub, fmt){
    return '<div class="an-gauge"><h3>' + esc(title) + "</h3>" + HBC.gauge(v, { width: 230, label: title, fmt: fmt }) + '<p class="sm mut">' + esc(sub) + "</p></div>";
  }

  /* ---------------- analysing overlay (after a live submit) ---------------- */
  function analysing(info, done){
    var steps = [
      ["Saving your answers", info.questions + " answers with the time spent on each"],
      ["Updating question analytics", "aggregating " + F.num(info.rows) + " answers from " + F.num(info.students) + " students"],
      ["Comparing with other students", info.peers + " students on this paper"],
      ["Building your insights and plan", "behaviour, pacing, targets, 7-day plan"]
    ];
    var el = document.createElement("div");
    el.className = "an-busy";
    el.innerHTML = '<div class="box"><span class="an-kicker">Analysing your attempt</span><h3 style="margin-top:6px">Your report is being prepared</h3><ol>' +
      steps.map(function(s){ return "<li><i></i><div>" + esc(s[0]) + "<small>" + esc(s[1]) + "</small></div></li>"; }).join("") + "</ol></div>";
    document.body.appendChild(el);
    var lis = el.querySelectorAll("li"), k = 0;
    (function next(){
      if(k > 0){ lis[k - 1].className = "ok"; lis[k - 1].querySelector("i").innerHTML = ico("check"); }
      if(k === lis.length){ setTimeout(function(){ el.remove(); done(); }, 350); return; }
      lis[k].className = "run"; k++;
      setTimeout(next, 520);
    })();
  }

  return { testView: testView, progressView: progressView, questionView: questionView, overviewView: overviewView, analysing: analysing };
})();
