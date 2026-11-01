import { expect, it } from "vitest";
import { faceMouthClosed, learnClosedMouth, type FaceFeatures } from "../../src/face-actions";
const mouth = (jaw: number, lipGap?: number) => ({ jaw, lipGap } as FaceFeatures);
it("separates natural closure, slightly open lips, and a closed-mouth smile", () => {
  expect(faceMouthClosed(mouth(.04, .005))).toBe(true);
  expect(faceMouthClosed({ ...mouth(.04, .005), smileLeft: .7, smileRight: .4 })).toBe(true);
  expect(faceMouthClosed(mouth(.04, .045))).toBe(false);
  expect(faceMouthClosed(mouth(.65, .005))).toBe(false);
  expect(faceMouthClosed(mouth(.02))).toBe(false);
  expect(faceMouthClosed(mouth(.02, NaN))).toBe(false);
});
it("learns bounded closed-mouth limits, never from an open-mouth baseline", () => {
  const limits = learnClosedMouth([mouth(.05, .006), mouth(.06, .008), mouth(.04, .007)]);
  expect(faceMouthClosed(mouth(.06, .008), { noise: {}, thresholds: {}, closedMouth: limits })).toBe(true);
  expect(faceMouthClosed(mouth(.05, .045), { noise: {}, thresholds: {}, closedMouth: limits })).toBe(false);
  expect(learnClosedMouth([mouth(.8, .2)])).toEqual(learnClosedMouth([]));
});

import { FaceDetector, FaceCalibration, faceFeatures } from "../../src/face-actions";
import { Game } from "../../src/game";
const neutral: FaceFeatures = { x:.65,y:.35,size:.3,roll:3,yaw:2,pitch:-2,jaw:.06,lipGap:.005,
  eyeLeft:.04,eyeRight:.05,eyesValid:true,browInner:.02,browLeft:.02,browRight:.02,browsValid:true,
  blinkLeft:.05,blinkRight:.05,apertureLeft:.22,apertureRight:.22,smileLeft:.1,smileRight:.1 };
function session(baseline = neutral) {
  const d = new FaceDetector(); let now = 0, id = 1; const hits: string[] = [];
  const hold = (change: Partial<FaceFeatures> | null, ms = 400, active = true) => {
    for (let t = 0; t < ms; t += 50) {
      now += 50; const hit = d.update(change === null ? null : { ...neutral, ...change }, baseline, now, { id, action:"pose_tree",active });
      if (hit) hits.push(hit);
    }
  };
  return { d, hold, hits, next: () => id++ };
}
it("accepts a pre-held closed mouth once per target, including consecutive closed walls", () => {
  const h = session(); h.hold({}); expect(h.hits).toEqual(["pose_tree"]);
  h.hold({}, 1000); expect(h.hits).toHaveLength(1);
  h.next(); h.hold({}); expect(h.hits).toHaveLength(2);
});
it("accepts closing from an open mouth without requiring a separate open-close cycle", () => {
  const h = session(); h.hold({jaw:.7,lipGap:.15}); expect(h.hits).toEqual([]);
  h.hold({}); expect(h.hits).toEqual(["pose_tree"]);
});
it("accepts closed-mouth smiling off-center even when another expression remains active", () => {
  const h = session(); h.hold({smileLeft:.7,smileRight:.4,x:.2,y:.7,roll:10,yaw:-10});
  expect(h.hits).toEqual(["pose_tree"]);
});
it("rejects low jaw scores with parted lips, a high jaw score and missing lip tracking", () => {
  const h = session(); h.hold({jaw:.03,lipGap:.045},800); h.hold({jaw:.7,lipGap:.005},800);
  h.hold({jaw:.03,lipGap:undefined},800); expect(h.hits).toEqual([]);
  expect(h.d.status).toContain("資料不足");
});
it("does not use a single frame or interrupted tracking to finish closure", () => {
  const h = session(); h.hold({},150); h.hold(null,100); h.hold({},200); expect(h.hits).toEqual([]);
  h.hold({},200); expect(h.hits).toEqual(["pose_tree"]);
});
it("checks current lips instead of smoothing the previous closed frame into success", () => {
  const h = session(); h.hold({},300); expect(h.hits).toEqual([]);
  h.hold({jaw:.03,lipGap:.045},50); expect(h.hits).toEqual([]);
  h.hold({},300); expect(h.hits).toEqual([]); h.hold({},100); expect(h.hits).toEqual(["pose_tree"]);
});
it("does not score before the prompt, but can hold closure immediately when the prompt becomes active", () => {
  const h = session(); h.hold({},1000,false); expect(h.hits).toEqual([]);
  h.hold({}); expect(h.hits).toEqual(["pose_tree"]);
});
it("does not confuse an open natural calibration baseline with actual closure", () => {
  const h = session({...neutral,jaw:.6,lipGap:.12}); h.hold({jaw:.6,lipGap:.12}); expect(h.hits).toEqual([]);
  h.hold({}); expect(h.hits).toEqual(["pose_tree"]);
});
it("advances the closed-mouth lesson directly without asking the player to open the mouth", () => {
  const c = new FaceCalibration(); c.start(); let now = 0;
  const hold = (change: Partial<FaceFeatures>, ms = 700) => {
    for (let t = 0; t < ms; t += 50) { now += 50; c.update({...neutral,...change},now); }
  };
  hold({},2100);
  for (const change of [{pitch:-14},{pitch:10},{yaw:14},{yaw:-10},{jaw:.7,lipGap:.1},{roll:24},{roll:-18},
    {eyeLeft:.6,eyeRight:.6},{smileLeft:.7,smileRight:.35}]) { hold(change); hold({},250); }
  expect(c.step).toBe(10); hold({},500);
  expect(c.step).toBe(11); expect(c.returning).toBe(false); expect(c.profile.closedMouth).toBeDefined();
  expect(c.message).not.toContain("先張嘴");
});
it("game completion stays bound to one obstacle while another closed wall needs its own hold", () => {
  const g = new Game(); g.start(["pose_tree"],{acceptFromPreview:true}); g.tick(3);
  g.tick(2); g.accept({id:1,action:"pose_tree",time:g.time}); g.tick(3.01);
  expect(g.score).toBe(100); expect(g.misses).toBe(0);
  g.tick(4); expect(g.misses).toBe(1);
});
it("extracts scale-invariant inner-lip gaps and rejects a missing or collapsed mouth", () => {
  const points = Array.from({length:478},()=>({x:.5,y:.4}));
  points[33]={x:.4,y:.35};points[263]={x:.6,y:.35};
  points[78]={x:.44,y:.6};points[308]={x:.56,y:.6};
  for (const [u,l,x] of [[13,14,.5],[82,87,.48],[312,317,.52]]) { points[u]={x,y:.6};points[l]={x,y:.601}; }
  const result={faceLandmarks:[points],faceBlendshapes:[{categories:[{categoryName:"jawOpen",score:.05}]}],
    facialTransformationMatrixes:[{rows:4,columns:4,data:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-40,1]}]};
  const f=faceFeatures(result,1).features!; expect(f.lipGap).toBeCloseTo(.005); expect(faceMouthClosed(f)).toBe(true);
  result.faceLandmarks=[points.map(p=>({x:.5+(p.x-.5)*.5,y:.5+(p.y-.5)*.5}))];
  expect(faceFeatures(result,1).features!.lipGap).toBeCloseTo(f.lipGap!);
  result.faceLandmarks[0][14].y+=.02;
  expect(faceMouthClosed(faceFeatures(result,1).features!)).toBe(false);
  result.faceLandmarks[0][14].x=NaN;
  expect(faceFeatures(result,1).features!.lipGap).toBeUndefined();
});
it("does not repeat the same closed obstacle after tracking loss", () => {
  const h = session(); h.hold({}); expect(h.hits).toHaveLength(1);
  h.hold(null,500); h.hold({},700); expect(h.hits).toHaveLength(1);
  h.next(); h.hold({}); expect(h.hits).toHaveLength(2);
});
