const params = new URLSearchParams(location.search);
if (params.has("backgroundRoad")) {
  void import("./background-road");
} else if (params.has("faceTest")) {
  void import("./face-test");
} else if (params.has("videoTest")) {
  void import("./video-test");
} else {
  void import("./main");
}
