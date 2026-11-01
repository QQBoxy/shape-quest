if (new URLSearchParams(location.search).has("faceTest")) {
  void import("./face-test");
} else if (new URLSearchParams(location.search).has("videoTest")) {
  void import("./video-test");
} else {
  void import("./main");
}
