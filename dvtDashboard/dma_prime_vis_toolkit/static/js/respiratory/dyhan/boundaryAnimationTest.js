export {
  case1,
  case2,
  case3,
  case4,
  case5,
  case6,
  case7,
  case8,
  case9,
  case10,
  case11,
  case12,
  case13,
  case14,
  case15,
  case16,
};

// const EASING = { drill: d3.easeCubicOut, roll: d3.easeCubicIn };
const EASING = { drill: d3.easeExpIn, roll: d3.easeLinear };
const DUR = { normal: 2000 };

function makePath(width, height, geojson) {
  const projection = d3.geoMercator().fitSize([width, height], geojson);
  return d3.geoPath(projection);
}

function ensureLayers(svgLike) {
  const svgEl = svgLike?.node ? svgLike.node() : svgLike;
  const root = d3.select(svgEl);
  if (root.empty()) throw new Error("SVG not found");
  let gLayers = root.select("#layers");
  if (gLayers.empty()) gLayers = root.append("g").attr("id", "layers");
  let upper = gLayers.select("#upper");
  if (upper.empty()) upper = gLayers.append("g").attr("id", "upper");
  let lower = gLayers.select("#lower");
  if (lower.empty()) lower = gLayers.append("g").attr("id", "lower");
  let flow = gLayers.select("#flow");
  if (flow.empty()) flow = gLayers.append("g").attr("id", "flow");

  // defs (clipPath 용)
  let defs = root.select("defs");
  if (defs.empty()) defs = root.append("defs");
  let clip = defs.select("#clipReveal");
  if (clip.empty())
    clip = defs
      .append("clipPath")
      .attr("id", "clipReveal")
      .append("circle")
      .attr("id", "clipCircle");

  return { root, svgEl, upper, lower, flow, defs };
}

function renderBoundaries(g, features, path, style = {}) {
  const {
    stroke = "#333",
    fill = "none",
    strokeWidth = 1,
    opacity = 1,
    scale = 1,
  } = style;
  const sel = g
    .selectAll("path")
    .data(
      features,
      (d) => d.properties?.id ?? d.id ?? JSON.stringify(d.geometry)
    );

  sel
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", fill)
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth)
    .attr("opacity", opacity)
    .attr("transform", `scale(${scale})`);

  sel.exit().remove();

  sel.attr("d", path);
}

function geoCentroidAvg(path, features) {
  if (!features || !features.length) return [0, 0];
  let sx = 0,
    sy = 0;
  features.forEach((f) => {
    const [x, y] = path.centroid(f);
    sx += x;
    sy += y;
  });
  return [sx / features.length, sy / features.length];
}

function centroidOf(d, path) {
  return path.centroid(d); // [cx, cy]
}

function scaleFromCenter(d, path, scale) {
  const [cx, cy] = centroidOf(d, path);
  return `translate(${cx},${cy}) scale(${scale}) translate(${-cx},${-cy})`;
}

// =============== 새 효과 1) line-draw (경계 그려지듯 등장) ===============
function behavior_lineDraw(selection, { stageDelay, ease, dur }) {
  selection.each(function () {
    const node = d3.select(this);
    const L = (this.getTotalLength && this.getTotalLength()) || 0;
    node
      .interrupt()
      .attr("opacity", 0)
      .attr("stroke-dasharray", L ? `${L} ${L}` : null)
      .attr("stroke-dashoffset", L ? L : null)
      .attr("stroke-width", 1.5)
      .transition()
      .delay(stageDelay)
      .duration(dur)
      .ease(ease)
      .attr("opacity", 1)
      .attr("stroke-dashoffset", 0)
      .transition()
      .duration(200)
      .attr("stroke-width", 1);
  });
}

// =============== 새 효과 3) clip-reveal (마스크로 열리듯 등장/사라짐) ===============
function behavior_clipReveal(layerSel, meta) {
  const { root, svgEl, stageDelay, ease, direction, role } = meta;
  // drill일 때 lower를 열어주고, roll일 때 lower를 닫는 용도로 주로 사용
  const box = svgEl.getBBox();
  const cx = box.width / 2,
    cy = box.height / 2;
  const maxR = Math.hypot(box.width, box.height);

  const circle = root.select("#clipCircle");
  // 초기 상태
  circle
    .attr("cx", cx)
    .attr("cy", cy)
    .attr("r", direction === "drill" ? 0 : maxR);
  layerSel.attr("clip-path", "url(#clipReveal)");

  // 애니메이션
  circle
    .interrupt()
    .transition()
    .delay(stageDelay)
    .duration(DUR)
    .ease(ease)
    .attr("r", direction === "drill" ? maxR : 0)
    .on("end", () => {
      if (direction === "roll" && role === "lower")
        layerSel.attr("clip-path", null);
    });
}

// 간단한 path morph (실패 시 fade 폴백)
function morphOrFade(selection, path, ease, dur) {
  selection.each(function (d) {
    const node = d3.select(this);
    const oldD = node.attr("d");
    const newD = path(d);
    let interp;
    try {
      interp = d3.interpolateString(oldD, newD);
    } catch (_) {
      interp = null;
    }
    if (interp) {
      node
        .transition()
        .duration(dur)
        .ease(ease)
        .attrTween("d", () => interp);
    } else {
      node
        .transition()
        .duration(dur / 2)
        .ease(ease)
        .attr("opacity", 0)
        .on("end", () => node.attr("d", newD))
        .transition()
        .duration(dur / 2)
        .ease(ease)
        .attr("opacity", 1);
    }
  });
}

// === 핵심: role(upper/lower) + direction(drill/roll) 에 따른 target opacity 분기 ===
function applyBehavior(selection, behaviors, meta) {
  const list = Array.isArray(behaviors) ? behaviors : [behaviors];
  const isDrill = meta.direction === "drill";
  const ease = EASING[isDrill ? "drill" : "roll"];

  const stageDelay =
    meta.mode === "staging"
      ? isDrill
        ? meta.role === "lower"
          ? 0
          : meta.dur
        : meta.role === "upper"
        ? 0
        : meta.dur
      : 0;

  // helper for fade/hold
  function toOpacity(role, direction) {
    return direction === "drill"
      ? role === "upper"
        ? 0
        : 1
      : role === "upper"
      ? 1
      : 0;
  }

  let dur = meta.dur;
  // 순차 실행
  list.forEach((name) => {
    switch (name) {
      case "hold":
        selection
          .interrupt()
          .transition()
          .delay(stageDelay)
          .duration(dur)
          .ease(ease)
          .attr("opacity", 1);
        break;
      case "fade":
        if (stageDelay != 0) {
          selection
            .interrupt()
            .attr("transform", "scale(1)")
            .transition()
            .duration(stageDelay)
            .ease(ease)
            .attr("stroke-width", 2);
        }

        selection
          // .interrupt()
          .attr("transform", "scale(1)")
          .transition()
          .delay(stageDelay)
          .duration(dur)
          .ease(ease)
          .attr("opacity", toOpacity(meta.role, meta.direction));
        // .attr("transform", (d) => scaleFromCenter(d, meta.path, 1));
        // .attr("transform", `scale(${toOpacity(meta.role, meta.direction)})`);
        break;
      case "split":
        // drill 전용: lower가 안에서 생성되는 상징 → line-draw가 없으면 기본 split은 간단 fade-in
        if (!(isDrill && meta.role === "lower")) break;

        selection.each(function (d) {
          const node = d3.select(this);
          const el = this; // SVGPathElement
          // 경로 길이(라인 드로잉 효과)
          let L = 0;
          try {
            L = el.getTotalLength();
          } catch (_) {
            L = 0;
          }

          // 초기 상태: 안 보이다가 선이 그려지며 등장
          node
            .interrupt()
            .attr("opacity", 0)
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", L ? `${L} ${L}` : null)
            .attr("stroke-dashoffset", L ? L : null)
            .transition()
            .delay(stageDelay)
            .duration(dur)
            .ease(ease)
            .attr("opacity", 1)
            .attr("stroke-dashoffset", 0)
            .transition()
            .duration(200)
            .attr("stroke-width", 1); // 원래 두께로 복귀
        });
        // selection
        //   .interrupt()
        //   .attr("opacity", 0)
        //   .transition()
        //   .delay(stageDelay)
        //   .duration(dur)
        //   .ease(ease)
        //   .attr("opacity", 1);
        break;
      case "lineDraw":
        behavior_lineDraw(selection, { stageDelay, ease, dur });
        break;
      case "clipReveal":
        // 레이어 단위로 clip 적용 (selection이 path들인 점을 고려해 부모 g를 전달)
        behavior_clipReveal(
          selection.empty()
            ? meta.layerSel
            : selection.select(function () {
                return this.parentNode;
              }),
          { ...meta, stageDelay, ease }
        );
        break;
      case "centroidFlow":
        selection
          .interrupt()
          .attr("opacity", 1)
          .attr("transform", (d) => scaleFromCenter(d, meta.path, 0.001))
          .transition()
          .delay(stageDelay)
          .duration(dur)
          .ease(ease)
          .attr("transform", (d) => scaleFromCenter(d, meta.path, 1));

        break;
      case "centroidFlow-lowerCenter":
        selection
          .interrupt()
          .attr("opacity", 1)
          .attr("transform", (d) => scaleFromCenter(d, meta.path, 0.3))
          .transition()
          .delay(stageDelay)
          .duration(dur)
          .ease(ease)
          .attr("transform", (d) => scaleFromCenter(d, meta.path, 1));

        break;
      case "morph":
        // 간단 morph (외곽 1↔1 권장; 복잡하면 fade fallback)
        selection.each(function (d) {
          const node = d3.select(this);
          const oldD = node.attr("d"),
            newD = meta.path(d);
          let interp;
          try {
            interp = d3.interpolateString(oldD, newD);
          } catch (_) {
            interp = null;
          }
          if (interp) {
            node
              .interrupt()
              .transition()
              .delay(stageDelay)
              .duration(dur)
              .ease(ease)
              .attrTween("d", () => interp);
          } else {
            node
              .interrupt()
              .transition()
              .delay(stageDelay)
              .duration(dur / 2)
              .ease(ease)
              .attr("opacity", 0)
              .on("end", () => node.attr("d", newD))
              .transition()
              .duration(dur / 2)
              .ease(ease)
              .attr("opacity", 1);
          }
        });
        break;
      default:
        // no-op
        break;
    }
  });
}

function transitionBoundaries(
  svgLike,
  upperFC,
  lowerFC,
  {
    direction = "drill",
    mode = "tween",
    upperBehavior = "fade",
    lowerBehavior = ["clipReveal", "lineDraw", "fade"],
    dur = DUR.normal,
    style = {},
  } = {}
) {
  const { root, svgEl, upper, lower, flow } = ensureLayers(svgLike);
  const width =
    svgEl.getBoundingClientRect().width || +svgEl.getAttribute("width") || 900;
  const height =
    svgEl.getBoundingClientRect().height ||
    +svgEl.getAttribute("height") ||
    520;
  const showUpper = direction === "roll",
    showLower = direction === "drill";
  const targetFC = showLower ? lowerFC : upperFC;
  const path = makePath(width, height, targetFC);

  // 시작 상태
  renderBoundaries(upper, upperFC.features, path, {
    stroke: "#333",
    fill: "none",
    strokeWidth: 1,
    opacity: showUpper ? 0 : 1,
    scale: showUpper ? 0 : 1,
    ...(style.upper || {}),
  });

  renderBoundaries(lower, lowerFC.features, path, {
    stroke: "#666",
    fill: "none",
    strokeWidth: 1,
    opacity: showLower ? 0 : 1,
    scale: showLower ? 0 : 1,
    ...(style.lower || {}),
  });

  // upper
  applyBehavior(upper.selectAll("path"), upperBehavior, {
    svgEl,
    root,
    layerSel: upper,
    flow,
    mode,
    direction,
    role: "upper",
    path,
    upperFC,
    lowerFC,
    dur,
  });

  // lower
  applyBehavior(lower.selectAll("path"), lowerBehavior, {
    svgEl,
    root,
    layerSel: lower,
    flow,
    mode,
    direction,
    role: "lower",
    path,
    upperFC,
    lowerFC,
    dur,
  });
}

// ========================= 16가지 프리셋 =========================
// (1) Drill | Tween | upper: fade | lower: fade
function case1(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "drill",
    mode: "staging",
    lowerBehavior: ["centroidFlow-lowerCenter"], // (1)+(3)+마무리 동기화
    // lowerBehavior: ["clipReveal", "lineDraw", "fade"],
    upperBehavior: "fade",
    dur: dur,
  });
  //   transitionBoundaries(svg, upperFC, lowerFC, {
  //     direction: "drill",
  //     mode: "tween",
  //     upperBehavior: "fade",
  //     lowerBehavior: "fade",
  //     dur: dur,
  //   });
}
// (2) Drill | Tween | upper: fade | lower: split
function case2(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "drill",
    mode: "tween",
    upperBehavior: "fade",
    lowerBehavior: "split",
    dur: dur,
  });
}
// (3) Drill | Tween | upper: hold | lower: fade
function case3(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "drill",
    mode: "tween",
    upperBehavior: "hold",
    lowerBehavior: "fade",
    dur: dur,
  });
}
// (4) Drill | Tween | upper: morph | lower: morph
function case4(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "drill",
    mode: "tween",
    upperBehavior: "morph",
    lowerBehavior: "morph",
    dur: dur,
  });
}
// (5) Drill | Staging | upper: fade | lower: fade
function case5(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "drill",
    mode: "staging",
    upperBehavior: "fade",
    lowerBehavior: "fade",
    dur: dur,
  });
}
// (6) Drill | Staging | upper: fade | lower: morph(확대 느낌)
function case6(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "drill",
    mode: "staging",
    upperBehavior: "fade",
    lowerBehavior: "morph",
    dur: dur,
  });
}
// (7) Drill | Staging | upper: hold | lower: split
function case7(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "drill",
    mode: "staging",
    upperBehavior: "hold",
    lowerBehavior: "split",
    dur: dur,
  });
}
// (8) Drill | Staging | upper: fade | lower: fade (draw 대체)
function case8(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "drill",
    mode: "staging",
    upperBehavior: "fade",
    lowerBehavior: "split",
    dur: dur,
  });
}
// // (8) Drill | Staging | upper: fade | lower: fade (draw 대체)
// function case8(svg, upperFC, lowerFC, dur){
//   transitionBoundaries(svg, upperFC, lowerFC, {
//     direction:"drill", mode:"staging", upperBehavior:"fade", lowerBehavior:"fade"
//   });
// }
// (9) Roll | Tween | upper: fade-in | lower: fade-out
function case9(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "roll",
    mode: "tween",
    upperBehavior: "fade",
    lowerBehavior: "fade",
    dur: dur,
  });
}
// (10) Roll | Tween | upper: fade-in | lower: fade-out (색 통합 강조 동일)
function case10(svg, upperFC, lowerFC, dur) {
  case9(svg, upperFC, lowerFC, dur);
}
// (11) Roll | Tween | upper: morph | lower: morph
function case11(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "roll",
    mode: "tween",
    upperBehavior: "morph",
    lowerBehavior: "morph",
    dur: dur,
  });
}
// (12) Roll | Tween | upper: hold | lower: fade
function case12(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "roll",
    mode: "tween",
    upperBehavior: "hold",
    lowerBehavior: "fade",
    dur: dur,
  });
}
// (13) Roll | Staging | lower: fade-out -> upper: fade-in
function case13(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "roll",
    mode: "staging",
    upperBehavior: "fade",
    lowerBehavior: "fade",
    dur: dur,
  });
}
// (14) Roll | Staging | upper: morph(확장) | lower: morph(수축)
function case14(svg, upperFC, lowerFC, dur) {
  transitionBoundaries(svg, upperFC, lowerFC, {
    direction: "roll",
    mode: "staging",
    upperBehavior: "morph",
    lowerBehavior: "morph",
    dur: dur,
  });
}
// (15) Roll | Staging | lower: step-fade | upper: vivid fade-in (동일 파라미터)
function case15(svg, upperFC, lowerFC, dur) {
  case13(svg, upperFC, lowerFC, dur);
}
// (16) Roll | Staging | lower: color-integrate then remove | upper: final activate (단순화)
function case16(svg, upperFC, lowerFC, dur) {
  case13(svg, upperFC, lowerFC, dur);
}
