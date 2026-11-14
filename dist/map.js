// An original two-base map illustration. Contours are generated from a height field.
(() => {
  const canvas = document.querySelector("#map");
  function draw() {
    const ctx = canvas.getContext("2d");
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(canvas.width / 440, canvas.height / 258);
    ctx.fillStyle = "#161c17";
    ctx.fillRect(0, 0, 440, 258);
    function elevation(x, y) {
      return (
        Math.sin(x / 58 + Math.sin(y / 64)) +
        0.55 * Math.cos(y / 26 + Math.cos(x / 63)) +
        0.26 * Math.sin((x + y) / 19) +
        0.13 * Math.cos(x / 13 - y / 22)
      );
    }
    const step = 6;
    for (let level = -1.8; level < 1.9; level += 0.115) {
      ctx.beginPath();
      for (let y = 0; y < 258; y += step)
        for (let x = 0; x < 440; x += step) {
          const corners = [
            [x, y],
            [x + step, y],
            [x + step, y + step],
            [x, y + step],
          ];
          const points = [];
          for (let i = 0; i < 4; i++) {
            const a = corners[i],
              b = corners[(i + 1) % 4];
            const va = elevation(...a),
              vb = elevation(...b);
            if (va < level === vb < level) continue;
            const t = (level - va) / (vb - va);
            points.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
          }
          for (let i = 1; i < points.length; i += 2) {
            ctx.moveTo(...points[i - 1]);
            ctx.lineTo(...points[i]);
          }
        }
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = "#394739";
      ctx.stroke();
    }
    function path(points, color, weight, dash = []) {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    path(
      [
        [142, -3],
        [154, 36],
        [195, 61],
        [188, 89],
        [214, 115],
        [209, 139],
        [247, 165],
        [251, 191],
        [293, 219],
        [308, 262],
      ],
      "#344b46",
      10,
    );
    const origin = [79, 198],
      end = [354, 59];
    path([origin, [85, 73], [124, 45], [247, 46], end], "#797d60", 2, [5, 4]);
    path(
      [origin, [167, 215], [306, 215], [353, 178], end],
      "#797d60",
      2,
      [5, 4],
    );
    path(
      [origin, [157, 168], [197, 134], [241, 112], [284, 86], end],
      "#e28e68",
      2.5,
    );
    for (const [x, y] of [
      [85, 106],
      [189, 46],
      [308, 211],
      [347, 146],
      [160, 165],
      [280, 89],
    ]) {
      ctx.fillStyle = "#c6bd92";
      ctx.fillRect(x - 2, y - 2, 5, 5);
    }
    for (const [i, [x, y]] of [origin, end].entries()) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = i ? "#452d22" : "#313b29";
      ctx.strokeStyle = i ? "#f3a37b" : "#b7ce9e";
      ctx.lineWidth = 2;
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
  }
  new ResizeObserver(draw).observe(canvas);
})();
