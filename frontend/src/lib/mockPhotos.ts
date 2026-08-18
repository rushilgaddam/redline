export interface MockPhoto {
  id: string;
  label: string;
  gradient: string;
  drawingHint?: string;
}

export const MOCK_PHOTOS: MockPhoto[] = [
  { id: "mock:breaker_cb3", label: "CB-3 breaker cubicle", gradient: "from-[#3a2a1f] to-[#1a1410]" },
  { id: "mock:contactor_bank", label: "Contactor bank", gradient: "from-[#1f2f3a] to-[#10171f]" },
  { id: "mock:ground_bus", label: "Ground bus", gradient: "from-[#233326] to-[#131a12]" },
  { id: "mock:door_interlock", label: "Door interlock", gradient: "from-[#2e2637] to-[#171219]" },
  { id: "mock:terminal_strip", label: "Terminal strip TB-1", gradient: "from-[#243447] to-[#121a24]" },
  { id: "mock:transformer", label: "Control transformer", gradient: "from-[#3a2f1f] to-[#1c160e]" },
  { id: "mock:mounting_slot", label: "Motor mounting slot", gradient: "from-[#2a3a2f] to-[#131f17]" },
  { id: "mock:belt_tensioner", label: "Belt tensioner", gradient: "from-[#3a2a2a] to-[#1c1313]" },
  { id: "mock:base_plate", label: "Motor base plate", gradient: "from-[#2a2f3a] to-[#13161f]" },
  { id: "mock:coupling_guard", label: "Coupling guard", gradient: "from-[#333a2a] to-[#191d13]" },
  { id: "mock:lube_port", label: "Lube port", gradient: "from-[#1f3a35] to-[#0f1c19]" },
  { id: "mock:main_breaker", label: "Main breaker", gradient: "from-[#3a1f24] to-[#1c0f12]" },
  { id: "mock:feeder_breaker", label: "Feeder breaker", gradient: "from-[#1f2e3a] to-[#0f171f]" },
  { id: "mock:ct_meter", label: "CT compartment / meter", gradient: "from-[#2f3a1f] to-[#171c0f]" },
  { id: "mock:relay_panel", label: "Relay panel", gradient: "from-[#3a1f37] to-[#1c0f1a]" },
  { id: "mock:general_floor", label: "Shop floor", gradient: "from-[#26303a] to-[#12171d]" },
];

export function getMockPhoto(id: string | null | undefined): MockPhoto | null {
  if (!id) return null;
  return MOCK_PHOTOS.find((p) => p.id === id) ?? { id, label: "Field photo", gradient: "from-[#26303a] to-[#12171d]" };
}
