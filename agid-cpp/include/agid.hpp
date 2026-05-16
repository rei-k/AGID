#pragma once

#include <cstdint>
#include <optional>
#include <string>

namespace agid {

struct Encoded {
  std::string id;
  std::string prefix;
  std::string hash;
  std::uint8_t face;
  bool isSea;
};

struct Decoded {
  double lat;
  double lon;
  std::string prefix;
  std::uint8_t face;
  bool isSea;
};

// Scaffold signatures aligned to agid-spec
std::optional<Encoded> encode(double lat, double lon);
std::optional<Decoded> decode(const std::string& id);

}  // namespace agid
