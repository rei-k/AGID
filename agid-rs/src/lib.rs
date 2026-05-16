//! agid-rs scaffold
//! Canonical contract: ../agid-spec/README.md

#[derive(Debug, Clone)]
pub struct EncodedAgid {
    pub id: String,
    pub prefix: String,
    pub hash: String,
    pub face: u8,
    pub is_sea: bool,
}

#[derive(Debug, Clone)]
pub struct DecodedAgid {
    pub lat: f64,
    pub lon: f64,
    pub prefix: String,
    pub face: u8,
    pub is_sea: bool,
}

pub fn encode(_lat: f64, _lon: f64) -> Result<EncodedAgid, String> {
    Err("not implemented: scaffold only".to_string())
}

pub fn decode(_id: &str) -> Result<Option<DecodedAgid>, String> {
    Err("not implemented: scaffold only".to_string())
}
