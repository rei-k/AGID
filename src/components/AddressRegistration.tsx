import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Search, 
  X, 
  Globe, 
  Building2, 
  Mail, 
  Map as MapIcon, 
  Navigation,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Snowflake,
  Anchor,
  Waves,
  Mountain,
  Palmtree,
  Ship,
  Sun,
  Trees,
  Fish,
  Square as AgidIcon,
  ShieldCheck as ShieldIcon,
  Landmark,
  History,
  QrCode,
  Upload,
  Camera,
  ChevronRight,
  Hash,
  ListFilter,
  Wand2
} from 'lucide-react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { cn } from '../lib/utils';
import { encodeAGID, decodeAGID, calculateMountainClass, calculateConsensusMetrics } from '../lib/agid';
import { regionalReverseGeocode } from '../services/GeocodingService';
import { PolarContext } from '../services/PolarService';
import { NatureContext } from '../services/NatureService';
import { SeaContext } from '../services/SeaService';
import { HeritageContext } from '../services/HeritageService';
import { JapaneseGeoContext } from '../services/JapaneseGeoService';
import { translateAddressOpenSource, BIG_TO_SMALL_COUNTRIES, formatAddress, COUNTRY_LANGUAGES, LANGUAGES, normalizeAddressText } from '../lib/addressUtils';
import { AddressRenderer, createCanonicalAddress } from '../lib/addressRendering';
import { toSimplified, toTraditional, detectChineseScript } from '../lib/chineseAddressUtils';
import { COUNTRIES } from '../constants/countries';
import { getAddressFormat, AddressFormat } from '../data/address_formats';
import { PostcodeInput } from './PostcodeInput';
import { wgs84togcj02, wgs84tobd09 } from '../lib/coordTransform';
import { lookupJapaneseZip } from '../services/JapaneseZipService';
import { generateAOID } from '../lib/aoid';

interface AddressRegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: any) => void;
  initialAgid?: string;
  initialAddress?: string;
  currentCoords?: { lat: number; lon: number };
  forceAoidMode?: boolean;
}

interface AddressMetadata {
  fmt: string;
  lfmt?: string;
  require: string;
  upper: string;
  zip_name?: string;
  state_name?: string;
  sub_name?: string;
  locality_name?: string;
  name_name?: string;
  org_name?: string;
  addr_name?: string;
  languages?: string;
  zip?: string;
  lang?: string;
}

const UI_STRINGS: Record<string, Record<string, string>> = {
  ja: {
    quickLookup: 'クイック検索',
    addressRegistration: '住所登録',
    globalAddressInput: 'グローバル住所入力 (libaddressinput)',
    registerAddress: '住所を登録する',
    countryRegion: '国 / 地域',
    phone: '電話番号',
    agid: 'AGID',
    lookupSuccess: '住所が入力されました！',
    lookupError: '検索に失敗しました',
    recipient: '氏名',
    organization: '会社・団体名',
    street: '住所',
    city: '市区町村',
    state: '都道府県',
    suburb: '町名・番地',
    postcode: '郵便番号',
    phonePlaceholder: '電話番号（国番号を含む）',
    agidPlaceholder: 'AGID（例: JP12345678）',
    postcodeLookup: '郵便番号検索',
    postcodePlaceholder: '7桁の郵便番号',
    jpAdminDetails: '日本国内行政詳細',
    prefecture: '都道府県',
    cityWard: '市区',
    townVillage: '町村',
    chome: '丁目',
    historicalName: '旧地名・歴史的名称',
    province: '省・州',
    district: '地区・郡',
    ward: '区',
    town: '町',
    village: '村',
    commune: 'コミューン',
    parish: '教区',
    quarter: 'クォーター',
    neighborhood: '近隣地域',
    governorate: '県・ガバノレート',
    emirate: '首長国',
    municipality: '自治体',
    county: '郡',
    oblast: '州 (Oblast)',
    viloyat: '州 (Viloyat)',
    region: '地域',
    department: '県 (Department)',
    canton: 'カントン',
    island: '島',
    atoll: '環礁',
    soum: 'ソム',
    bag: 'バグ',
    block: 'ブロック',
    lot: 'ロット',
    section: 'セクション',
    lane: 'レーン',
    alley: 'アレイ',
    floor: '階',
    room: '部屋',
    registerAoid: 'AOIDを生成・登録する',
    aoidTip: 'AOIDは自分だけが管理できるプライベートな住所IDです。建物名や部屋番号、連絡先を含みます。',
    registerAsAoid: 'AOIDとしてプライベート登録する',
    phoneRequired: '電話番号は必須です',
    nameRequired: '氏名は必須です',
    tab_indian_langs: 'インド諸語',
    tab_sa_langs: '南アフリカ諸語',
    tab_de_langs: 'ゲルマン諸語',
    tab_regional_langs: '地域言語',
    tab_es_regional: 'スペイン諸州',
    tab_it_regional: 'イタリア諸州',
    tab_latam_es: 'スペイン語 (グローバル)',
    tab_lusosphere: 'ポルトガル語 (グローバル)',
    tab_arabic_global: 'アラビア語 (グローバル)',
    tab_mena_langs: '中東・北アフリカ (他諸語)',
    tab_anglosphere: '英語圏 (グローバル)',
    tab_greater_china: '大中華圏',
    tab_francophonie: 'フランス語圏',
    tab_zh_hans: '簡体字中国語',
    tab_zh_hant: '繁体字中国語'
  },
  de: {
    quickLookup: 'Schnellsuche',
    addressRegistration: 'Adressregistrierung',
    globalAddressInput: 'Globale Adresseingabe',
    registerAddress: 'Adresse registrieren',
    countryRegion: 'Land / Region',
    phone: 'Telefon',
    agid: 'AGID',
    lookupSuccess: 'Adressfelder ausgefüllt!',
    postcodePlaceholder: 'Postleitzahl',
    jpAdminDetails: 'Verwaltungsdetails',
    prefecture: 'Bundesland',
    cityWard: 'Stadt / Bezirk',
    townVillage: 'Gemeinde / Dorf',
    chome: 'Chome',
    historicalName: 'Historischer Name',
    province: 'Provinz',
    district: 'Regierungsbezirk',
    ward: 'Stadtteil / Bezirk',
    town: 'Stadt',
    village: 'Dorf',
    commune: 'Kommune',
    parish: 'Gemeinde (Pfarrei)',
    quarter: 'Quartier',
    neighborhood: 'Viertel',
    governorate: 'Gouvernement',
    emirate: 'Emirat',
    municipality: 'Gemeinde',
    county: 'Landkreis',
    oblast: 'Oblast',
    viloyat: 'Viloyat',
    region: 'Region',
    department: 'Abteilung / Bezirk',
    canton: 'Kanton',
    island: 'Insel',
    atoll: 'Atoll',
    soum: 'Soum',
    bag: 'Bag',
    block: 'Block',
    lot: 'Lot',
    section: 'Sektion',
    lane: 'Gasse',
    alley: 'Allee',
    floor: 'Etage',
    room: 'Zimmer',
    registerAoid: 'AOID generieren & registrieren',
    aoidTip: 'AOID ist eine private Adress-ID. Sie enthält Gebäudenamen, Zimmernummern und Kontaktinfo.',
    registerAsAoid: 'Privat als AOID registrieren',
    phoneRequired: 'Telefonnummer ist erforderlich',
    nameRequired: 'Name ist erforderlich',
    tab_indian_langs: 'Indische Sprachen',
    tab_sa_langs: 'Südafrikanische Sprachen',
    tab_de_langs: 'Germanische Sprachen',
    tab_regional_langs: 'Regionalsprachen',
    tab_es_regional: 'Regionen Spanien',
    tab_it_regional: 'Regionen Italien',
    tab_latam_es: 'Spanisch (Global)',
    tab_lusosphere: 'Portugiesisch (Global)',
    tab_arabic_global: 'Arabisch (Global)',
    tab_mena_langs: 'MENA-Sprachen',
    tab_anglosphere: 'Anglosphäre',
    tab_greater_china: 'Großchina',
    tab_francophonie: 'Frankophonie',
    tab_zh_hans: 'Vereinfachtes Chinesisch',
    tab_zh_hant: 'Traditionelles Chinesisch'
  },
  en: {
    quickLookup: 'Quick Lookup',
    addressRegistration: 'Address Registration',
    globalAddressInput: 'Global Address Input (libaddressinput)',
    registerAddress: 'Register Address',
    countryRegion: 'Country / Region',
    phone: 'Phone',
    agid: 'AGID',
    lookupSuccess: 'Address fields populated!',
    lookupError: 'Lookup failed',
    recipient: 'Recipient Name',
    organization: 'Organization',
    street: 'Street Address',
    city: 'City / Town',
    state: 'State / Province',
    suburb: 'Suburb / District',
    postcode: 'Postal Code',
    phonePlaceholder: 'Phone Number (with country code)',
    agidPlaceholder: 'AGID (e.g. JP12345678)',
    postcodeLookup: 'Postcode Lookup',
    postcodePlaceholder: '7-digit postcode',
    jpAdminDetails: 'Japanese Administrative Details',
    prefecture: 'Prefecture',
    cityWard: 'City / Ward',
    townVillage: 'Town / Village',
    chome: 'Chome',
    historicalName: 'Historical Name',
    province: 'Province',
    district: 'District',
    ward: 'Ward',
    town: 'Town',
    village: 'Village',
    commune: 'Commune',
    parish: 'Parish',
    quarter: 'Quarter',
    neighborhood: 'Neighborhood',
    governorate: 'Governorate',
    emirate: 'Emirate',
    municipality: 'Municipality',
    county: 'County',
    oblast: 'Oblast',
    viloyat: 'Viloyat',
    region: 'Region',
    department: 'Department',
    canton: 'Canton',
    island: 'Island',
    atoll: 'Atoll',
    soum: 'Soum',
    bag: 'Bag',
    block: 'Block',
    lot: 'Lot',
    section: 'Section',
    lane: 'Lane',
    alley: 'Alley',
    floor: 'Floor',
    room: 'Room',
    registerAoid: 'Generate & Register AOID',
    aoidTip: 'AOID is a private ID containing fixed details like building, room, and phone. Not searchable by others.',
    registerAsAoid: 'Register as Private AOID',
    phoneRequired: 'Phone is required for AOID',
    nameRequired: 'Name is required for AOID',
    tab_indian_langs: 'Indian Languages',
    tab_sa_langs: 'South African Languages',
    tab_de_langs: 'Germanic Languages',
    tab_regional_langs: 'Regional Languages',
    tab_es_regional: 'Spain Regions',
    tab_it_regional: 'Italy Regions',
    tab_latam_es: 'Spanish (Global)',
    tab_lusosphere: 'Portuguese (Global)',
    tab_arabic_global: 'Arabic (Global)',
    tab_mena_langs: 'MENA (Other Languages)',
    tab_anglosphere: 'Anglosphere (Global)',
    tab_greater_china: 'Greater China',
    tab_francophonie: 'Francophonie',
    tab_zh_hans: 'Simplified Chinese',
    tab_zh_hant: 'Traditional Chinese'
  },
  'zh-Hant': {
    quickLookup: '快速搜索',
    addressRegistration: '地址註冊',
    globalAddressInput: '全球地址輸入',
    registerAddress: '註冊地址',
    countryRegion: '國家 / 地區',
    phone: '電話',
    agid: 'AGID',
    lookupSuccess: '地址已填充！',
    lookupError: '搜索失敗',
    recipient: '收件人姓名',
    organization: '組織 / 公司',
    street: '街道地址',
    city: '城市 / 鎮',
    state: '省 / 州',
    suburb: '地區 / 郊區',
    postcode: '郵政編碼',
    phonePlaceholder: '電話號碼（含國家代碼）',
    agidPlaceholder: 'AGID（例如 JP12345678）',
    postcodeLookup: '郵編搜索',
    postcodePlaceholder: '郵政編碼',
    jpAdminDetails: '日本行政詳情',
    prefecture: '都道府縣',
    cityWard: '市 / 區',
    townVillage: '町 / 村',
    chome: '丁目',
    historicalName: '歷史名稱',
    province: '省',
    district: '區 / 縣',
    ward: '區',
    town: '鎮',
    village: '村',
    commune: '市鎮',
    parish: '教區',
    quarter: '地區',
    neighborhood: '鄰里',
    governorate: '省 / 縣',
    emirate: '酋長國',
    municipality: '自治市',
    county: '郡 / 縣',
    oblast: '州 (Oblast)',
    viloyat: '州 (Viloyat)',
    region: '區域',
    department: '省 (Department)',
    canton: '州 (Canton)',
    island: '島嶼',
    atoll: '環礁',
    soum: '蘇木',
    bag: '巴格',
    block: '街區',
    lot: '地號',
    section: '部分',
    lane: '巷',
    alley: '弄',
    floor: '樓層',
    room: '房間',
    registerAoid: '生成並註冊 AOID',
    aoidTip: 'AOID 是一個私人 ID，包含建築、房間和電話等固定詳情。其他人無法搜索。',
    registerAsAoid: '註冊為私人 AOID',
    phoneRequired: 'AOID 需要電話號碼',
    nameRequired: 'AOID 需要姓名',
    tab_indian_langs: '印度語言',
    tab_sa_langs: '南非語言',
    tab_de_langs: '日耳曼語言',
    tab_regional_langs: '地區語言',
    tab_es_regional: '西班牙地區',
    tab_it_regional: '意大利地區',
    tab_latam_es: '西班牙語 (全球)',
    tab_lusosphere: '葡萄牙語 (全球)',
    tab_arabic_global: '阿拉伯語 (全球)',
    tab_mena_langs: '中東北非語系',
    tab_anglosphere: '英語圈 (全球)',
    tab_greater_china: '大中華地區',
    tab_francophonie: '法語圈',
    tab_zh_hans: '簡體中文',
    tab_zh_hant: '繁體中文'
  },
  'zh-Hans': {
    quickLookup: '快速搜索',
    addressRegistration: '地址注册',
    globalAddressInput: '全球地址输入',
    registerAddress: '注册地址',
    countryRegion: '国家 / 地区',
    phone: '电话',
    agid: 'AGID',
    lookupSuccess: '地址已填充！',
    lookupError: '搜索失败',
    recipient: '收件人姓名',
    organization: '组织 / 公司',
    street: '街道地址',
    city: '城市 / 镇',
    state: '省 / 市',
    suburb: '地区 / 街道',
    postcode: '邮政编码',
    phonePlaceholder: '电话号码（含国家代码）',
    agidPlaceholder: 'AGID（例如 JP12345678）',
    postcodeLookup: '邮编搜索',
    postcodePlaceholder: '邮政编码',
    jpAdminDetails: '日本行政详情',
    prefecture: '都道府县',
    cityWard: '市 / 区',
    townVillage: '町 / 村',
    chome: '丁目',
    historicalName: '历史名称',
    province: '省',
    district: '地区 / 县',
    ward: '区',
    town: '镇',
    village: '村',
    commune: '市镇',
    parish: '教区',
    quarter: '地区',
    neighborhood: '邻里',
    governorate: '省 / 县',
    emirate: '酋长国',
    municipality: '自治市',
    county: '郡 / 县',
    oblast: '州 (Oblast)',
    viloyat: '州 (Viloyat)',
    region: '区域',
    department: '省 (Department)',
    canton: '州 (Canton)',
    island: '岛屿',
    atoll: '环礁',
    soum: '苏木',
    bag: '巴格',
    block: '街区',
    lot: '地号',
    section: '部分',
    lane: '巷',
    alley: '弄',
    floor: '楼层',
    room: '房间',
    registerAoid: '生成并注册 AOID',
    aoidTip: 'AOID 是一个私人 ID，包含建筑、房间和电话等固定详情。其他人无法搜索。',
    registerAsAoid: '注册为私人 AOID',
    phoneRequired: 'AOID 需要电话号码',
    nameRequired: 'AOID 需要姓名',
    tab_indian_langs: '印度语言',
    tab_sa_langs: '南非语言',
    tab_de_langs: '日耳曼语言',
    tab_regional_langs: '地区语言',
    tab_es_regional: '西班牙地区',
    tab_it_regional: '意大利地区',
    tab_latam_es: '西班牙语 (全球)',
    tab_lusosphere: '葡萄牙语 (全球)',
    tab_arabic_global: '阿拉伯语 (全球)',
    tab_mena_langs: '中东北非语系',
    tab_anglosphere: '英语圈 (全球)',
    tab_greater_china: '大中华地区',
    tab_francophonie: '法语圈',
    tab_zh_hans: '简体中文',
    tab_zh_hant: '繁体中文'
  },
  'es': {
    quickLookup: 'Búsqueda Rápida',
    addressRegistration: 'Registro de Dirección',
    globalAddressInput: 'Entrada de Dirección Global',
    registerAddress: 'Registrar Dirección',
    countryRegion: 'País / Región',
    phone: 'Teléfono',
    agid: 'AGID',
    lookupSuccess: '¡Campos de dirección completados!',
    lookupError: 'Error en la búsqueda',
    recipient: 'Nombre del Destinatario',
    organization: 'Organización / Empresa',
    street: 'Dirección (Calle)',
    city: 'Ciudad / Población',
    state: 'Estado / Provincia',
    suburb: 'Suburbio / Barrio',
    postcode: 'Código Postal',
    phonePlaceholder: 'Número de Teléfono (con código de país)',
    agidPlaceholder: 'AGID (ej. JP12345678)',
    postcodeLookup: 'Buscar por CP',
    postcodePlaceholder: 'Código postal',
    jpAdminDetails: 'Detalles Adm. Japoneses',
    prefecture: 'Prefectura',
    cityWard: 'Ciudad / Distrito',
    townVillage: 'Pueblo / Aldea',
    chome: 'Chome',
    historicalName: 'Nombre Histórico',
    province: 'Provincia',
    district: 'Distrito',
    ward: 'Distrito / Barrio',
    town: 'Pueblo',
    village: 'Aldea / Villa',
    commune: 'Comuna',
    parish: 'Parroquia',
    quarter: 'Barrio / Cuartel',
    neighborhood: 'Vecindario',
    governorate: 'Gobernación',
    emirate: 'Emirato',
    municipality: 'Municipio',
    county: 'Condado',
    oblast: 'Óblast',
    viloyat: 'Viloyat',
    region: 'Región',
    department: 'Departamento',
    canton: 'Cantón',
    island: 'Isla',
    atoll: 'Atolón',
    soum: 'Soum',
    bag: 'Bag',
    block: 'Bloque',
    lot: 'Lote',
    section: 'Sección',
    lane: 'Callejón / Senda',
    alley: 'Callejón',
    floor: 'Piso',
    room: 'Habitación',
    registerAoid: 'Generar y Registrar AOID',
    aoidTip: 'AOID es un ID privado con detalles fijos como edificio, habitación y teléfono. No es público.',
    registerAsAoid: 'Registrar como AOID Privado',
    phoneRequired: 'El teléfono es obligatorio para AOID',
    nameRequired: 'El nombre es obligatorio para AOID',
    tab_indian_langs: 'Lenguas Indias',
    tab_sa_langs: 'Lenguas Sudafricanas',
    tab_de_langs: 'Lenguas Germánicas',
    tab_regional_langs: 'Lenguas Regionales',
    tab_es_regional: 'Regiones de España',
    tab_it_regional: 'Regiones de Italia',
    tab_latam_es: 'Español (Global)',
    tab_lusosphere: 'Português (Global)',
    tab_arabic_global: 'Árabe (Global)',
    tab_mena_langs: 'Lenguas MENA',
    tab_anglosphere: 'Anglosfera',
    tab_greater_china: 'Gran China',
    tab_francophonie: 'Francofonía',
    tab_zh_hans: 'Chino Simplificado',
    tab_zh_hant: 'Chino Tradicional'
  },
  'pt': {
    quickLookup: 'Busca Rápida',
    addressRegistration: 'Registro de Endereço',
    globalAddressInput: 'Entrada de Endereço Global',
    registerAddress: 'Registrar Endereço',
    countryRegion: 'País / Região',
    phone: 'Telefone',
    agid: 'AGID',
    lookupSuccess: 'Campos de endereço preenchidos!',
    lookupError: 'Falha na busca',
    recipient: 'Nome do Destinatário',
    organization: 'Organização / Empresa',
    street: 'Endereço (Rua)',
    city: 'Cidade / Localidade',
    state: 'Estado / Província',
    suburb: 'Bairro / Distrito',
    postcode: 'Código Postal',
    phonePlaceholder: 'Número de Telefone (com código de país)',
    agidPlaceholder: 'AGID (ex. JP12345678)',
    postcodeLookup: 'Buscar CEP',
    postcodePlaceholder: 'Código postal',
    jpAdminDetails: 'Detalhes Adm. Japoneses',
    prefecture: 'Prefeitura',
    cityWard: 'Cidade / Distrito',
    townVillage: 'Vila / Aldeia',
    chome: 'Chome',
    historicalName: 'Nome Histórico',
    province: 'Província',
    district: 'Distrito',
    ward: 'Distrito / Bairro',
    town: 'Vila',
    village: 'Aldeia',
    commune: 'Comuna',
    parish: 'Freguesia',
    quarter: 'Bairro',
    neighborhood: 'Vizinhança',
    governorate: 'Província / Município',
    emirate: 'Emirado',
    municipality: 'Município',
    county: 'Condado',
    oblast: 'Oblast',
    viloyat: 'Viloyat',
    region: 'Região',
    department: 'Departamento',
    canton: 'Cantão',
    island: 'Ilha',
    atoll: 'Atol',
    soum: 'Soum',
    bag: 'Bag',
    block: 'Bloco',
    lot: 'Lote',
    section: 'Seção',
    lane: 'Travessa',
    alley: 'Beco',
    floor: 'Andar',
    room: 'Sala',
    registerAoid: 'Gerar e Registrar AOID',
    aoidTip: 'AOID é um ID privado com detalhes fixos como prédio, sala e telefone. Não é público.',
    registerAsAoid: 'Registrar como AOID Privado',
    phoneRequired: 'Telefone é obrigatório para AOID',
    nameRequired: 'Nome é obrigatório para AOID',
    tab_indian_langs: 'Línguas Indianas',
    tab_sa_langs: 'Línguas Sul-Africanas',
    tab_de_langs: 'Línguas Germânicas',
    tab_regional_langs: 'Línguas Regionais',
    tab_es_regional: 'Regiões da Espanha',
    tab_it_regional: 'Regiões da Itália',
    tab_latam_es: 'Espanhol (Global)',
    tab_lusosphere: 'Português (Global)',
    tab_arabic_global: 'Árabe (Global)',
    tab_mena_langs: 'Línguas MENA',
    tab_anglosphere: 'Anglosfera',
    tab_greater_china: 'Grande China',
    tab_francophonie: 'Francofonia',
    tab_zh_hans: 'Chinês Simplificado',
    tab_zh_hant: 'Chinês Tradicional'
  },
  'fr': {
    quickLookup: 'Recherche Rapide',
    addressRegistration: 'Enregistrement d\'Adresse',
    globalAddressInput: 'Saisie d\'Adresse Globale',
    registerAddress: 'Enregistrer l\'Adresse',
    countryRegion: 'Pays / Région',
    phone: 'Téléphone',
    agid: 'AGID',
    lookupSuccess: 'Champs d\'adresse remplis !',
    lookupError: 'Échec de la recherche',
    recipient: 'Nom du Destinataire',
    organization: 'Organisation / Entreprise',
    street: 'Adresse (Rue)',
    city: 'Ville / Localité',
    state: 'État / Province',
    suburb: 'Quartier / Banlieue',
    postcode: 'Code Postal',
    phonePlaceholder: 'Numéro de téléphone (avec code pays)',
    agidPlaceholder: 'AGID (ex. JP12345678)',
    postcodeLookup: 'Recherche Code Postal',
    postcodePlaceholder: 'Code postal',
    jpAdminDetails: 'Détails Adm. Japonais',
    prefecture: 'Préfecture',
    cityWard: 'Ville / Arrondissement',
    townVillage: 'Commune / Village',
    chome: 'Chome',
    historicalName: 'Nom Historique',
    province: 'Province',
    district: 'District',
    ward: 'Arrondissement',
    town: 'Ville',
    village: 'Village',
    commune: 'Commune',
    parish: 'Paroisse',
    quarter: 'Quartier',
    neighborhood: 'Voisinage',
    governorate: 'Gouvernorat',
    emirate: 'Émirat',
    municipality: 'Municipalité',
    county: 'Comté',
    oblast: 'Oblast',
    viloyat: 'Viloyat',
    region: 'Région',
    department: 'Département',
    canton: 'Canton',
    island: 'Île',
    atoll: 'Atoll',
    soum: 'Soum',
    bag: 'Bag',
    block: 'Bloc',
    lot: 'Lot',
    section: 'Section',
    lane: 'Allée',
    alley: 'Ruelle',
    floor: 'Étage',
    room: 'Appartement / Chambre',
    registerAoid: 'Générer & Enregistrer AOID',
    aoidTip: 'AOID est un identifiant privé contenant des détails comme le bâtiment et le téléphone. Non public.',
    registerAsAoid: 'Enregistrer comme AOID Privé',
    phoneRequired: 'Téléphone requis pour AOID',
    nameRequired: 'Nom requis pour AOID',
    tab_indian_langs: 'Langues Indiennes',
    tab_sa_langs: 'Langues Sud-Africaines',
    tab_de_langs: 'Langues Germaniques',
    tab_regional_langs: 'Langues Régionales',
    tab_es_regional: 'Régions d\'Espagne',
    tab_it_regional: 'Régions d\'Italie',
    tab_latam_es: 'Espagnol (Global)',
    tab_lusosphere: 'Portugais (Global)',
    tab_arabic_global: 'Arabe (Global)',
    tab_mena_langs: 'Langues MENA',
    tab_anglosphere: 'Anglosphère',
    tab_greater_china: 'Grand Chine',
    tab_francophonie: 'Francophonie',
    tab_zh_hans: 'Chinois Simplifié',
    tab_zh_hant: 'Chinois Traditionnel'
  },
  'ar': {
    quickLookup: 'بحث سريع',
    addressRegistration: 'تسجيل العنوان',
    globalAddressInput: 'إدخال العنوان العالمي',
    registerAddress: 'تسجيل العنوان',
    countryRegion: 'البلد / المنطقة',
    phone: 'الهاتف',
    agid: 'AGID',
    lookupSuccess: 'تم ملء حقول العنوان!',
    lookupError: 'فشل البحث',
    recipient: 'اسم المستلم',
    organization: 'المنظمة / الشركة',
    street: 'عنوان الشارع',
    city: 'المدينة',
    state: 'الولاية / المقاطعة',
    suburb: 'الضاحية / الحي',
    postcode: 'الرمز البريدي',
    phonePlaceholder: 'رقم الهاتف (مع رمز البلد)',
    agidPlaceholder: 'AGID (مثلاً JP12345678)',
    postcodeLookup: 'بحث بالرمز البريدي',
    postcodePlaceholder: 'الرمز البريدي',
    jpAdminDetails: 'التفاصيل الإدارية اليابانية',
    prefecture: 'محافظة',
    cityWard: 'مدينة / حي',
    townVillage: 'بلدة / قرية',
    chome: 'تشومي',
    historicalName: 'الاسم التاريخي',
    province: 'مقاطعة',
    district: 'مديرية / حي',
    ward: 'جناح',
    town: 'بلدة',
    village: 'قرية',
    commune: 'بلدية',
    parish: 'أبرشية',
    quarter: 'ربع',
    neighborhood: 'جوار',
    governorate: 'محافظة',
    emirate: 'إمارة',
    municipality: 'بلدية',
    county: 'مقاطعة',
    oblast: 'أوبلاست',
    viloyat: 'فيلايت',
    region: 'منطقة',
    department: 'قسم',
    canton: 'كانتون',
    island: 'جزيرة',
    atoll: 'شعب حلقي',
    soum: 'سوم',
    bag: 'باغ',
    block: 'كتلة',
    lot: 'قطعة أرض',
    section: 'قسم',
    lane: 'ممر',
    alley: 'زقاق',
    floor: 'طابق',
    room: 'غرفة',
    registerAoid: 'توليد وتسجيل AOID',
    aoidTip: 'AOID هو معرف خاص يحتوي على تفاصيل المبنى والهاتف. ليس علنياً.',
    registerAsAoid: 'تسجيل كـ AOID خاص',
    phoneRequired: 'الهاتف مطلوب لـ AOID',
    nameRequired: 'الاسم مطلوب لـ AOID',
    tab_indian_langs: 'اللغات الهندية',
    tab_sa_langs: 'لغات جنوب أفريقيا',
    tab_de_langs: 'اللغات الجرمانية',
    tab_regional_langs: 'اللغات الإقليمية',
    tab_es_regional: 'مناطق إسبانيا',
    tab_it_regional: 'مناطق إيطاليا',
    tab_latam_es: 'الإسبانية (عالمي)',
    tab_lusosphere: 'البرتغالية (عالمي)',
    tab_arabic_global: 'العربية (عالمي)',
    tab_mena_langs: 'لغات الشرق الأوسط',
    tab_anglosphere: 'الأنجلوسفير',
    tab_greater_china: 'الصين الكبرى',
    tab_francophonie: 'الفرنكوفونية',
    tab_zh_hans: 'الصينية المبسطة',
    tab_zh_hant: 'الصينية التقليدية'
  }
};

const LANGUAGE_NAMES: Record<string, string> = {
  'local': 'Local',
  'en': 'English',
  'en-GB': 'English (UK)',
  'en-US': 'English (US)',
  'en-AU': 'English (AU)',
  'en-CA': 'English (CA)',
  'en-NZ': 'English (NZ)',
  'en-IE': 'English (IE)',
  'en-ZA': 'English (ZA)',
  'en-IN': 'English (IN)',
  'en-SG': 'English (SG)',
  'en-PH': 'English (PH)',
  'en-JM': 'English (JM)',
  'en-BS': 'English (BS)',
  'en-BB': 'English (BB)',
  'en-GD': 'English (GD)',
  'en-GY': 'English (GY)',
  'en-TT': 'English (TT)',
  'en-NG': 'English (NG)',
  'en-GH': 'English (GH)',
  'en-KE': 'English (KE)',
  'en-BZ': 'English (BZ)',
  'en-MY': 'English (MY)',
  'en-PK': 'English (PK)',
  'en-BD': 'English (BD)',
  'en-LK': 'English (LK)',
  'en-NP': 'English (NP)',
  'en-MV': 'English (MV)',
  'en-AG': 'English (AG)',
  'en-KN': 'English (KN)',
  'en-LC': 'English (LC)',
  'en-VC': 'English (VC)',
  'ja': '日本語',
  'zh-Hans': '简体中文 (中国)',
  'zh-Hant': '繁體中文',
  'zh-Hant-TW': '繁體中文 (台灣)',
  'zh-Hant-HK': '繁體中文 (香港)',
  'zh-Hant-MO': '繁體中文 (澳門)',
  'ko': '한국어',
  'fr': 'Français',
  'de': 'Deutsch',
  'it': 'Italiano',
  'es': 'Español',
  'pt': 'Português',
  'es-MX': 'Español (México)',
  'es-AR': 'Español (Argentina)',
  'es-CO': 'Español (Colombia)',
  'es-PE': 'Español (Perú)',
  'es-VE': 'Español (Venezuela)',
  'es-CL': 'Español (Chile)',
  'es-EC': 'Español (Ecuador)',
  'es-BO': 'Español (Bolivia)',
  'es-PY': 'Español (Paraguay)',
  'es-UY': 'Español (Uruguay)',
  'es-PA': 'Español (Panamá)',
  'es-CR': 'Español (Costa Rica)',
  'es-NI': 'Español (Nicaragua)',
  'es-HN': 'Español (Honduras)',
  'es-SV': 'Español (El Salvador)',
  'es-GT': 'Español (Guatemala)',
  'es-DO': 'Español (Rep. Dominicana)',
  'es-PR': 'Español (Puerto Rico)',
  'es-CU': 'Español (Cuba)',
  'pt-AO': 'Português (Angola)',
  'pt-MZ': 'Português (Moçambique)',
  'pt-CV': 'Português (Cabo Verde)',
  'pt-GW': 'Português (Guiné-Bissau)',
  'pt-ST': 'Português (São Tomé e Príncipe)',
  'es-GQ': 'Español (Guinea Ecuatorial)',
  'ru': 'Русский',
  'tr': 'Türkçe',
  'vi': 'Tiếng Việt',
  'th': 'ไทย',
  'ar': 'العربية',
  'hi': 'हिन्दी (Hindi)',
  'bn': 'বাংলা (Bengali)',
  'ta': 'தமிழ் (Tamil)',
  'te': 'తెలుగు (Telugu)',
  'mr': 'मराठी (Marathi)',
  'gu': 'ગુજરાતી (Gujarati)',
  'kn': 'ಕನ್ನಡ (Kannada)',
  'ml': 'മലയാളം (Malayalam)',
  'pa': 'ਪੰਜਾਬੀ (Punjabi)',
  'ur': 'اردو (Urdu)',
  'fa': 'فارسی',
  'he': 'עברית',
  'sw': 'Kiswahili',
  'am': 'አማርኛ',
  'kk': 'Қазақ тілі',
  'uz': 'Oʻzbek',
  'mn': 'Монгол',
  'is': 'Íslenska',
  'cs': 'Čeština',
  'sk': 'Slovenčina',
  'ro': 'Română',
  'bg': 'Български',
  'hr': 'Hrvatski',
  'sr': 'Српски',
  'el': 'Ελληνικά',
  'ca': 'Català',
  'mt': 'Malti',
  'lb': 'Lëtzebuergesch',
  'fo': 'Føroyskt',
  'kl': 'Kalaallisut',
  'dv': 'ދިވެހި',
  'mh': 'Kajin M̧ajeļ',
  'pau': 'Belau',
  'na': 'Dorerin Naoero',
  'gil': 'Kiribati',
  'tvl': 'Tuvalu',
  'to': 'Lea Faka-Tonga',
  'sm': 'Gagana Sāmoa',
  'fj': 'Vosa Vakaviti',
  'crs': 'Seselwa',
  'mfe': 'Morisyen',
  'in-regional': 'Indian Languages',
  'za-regional': 'South African Languages',
  'ms': 'Bahasa Melayu',
  'id': 'Bahasa Indonesia',
  'tl': 'Tagalog',
  'romaji': 'Romaji'
};

const COUNTRY_DEFAULT_LANGS: Record<string, string> = {
  'JP': 'ja',
  'CN': 'zh-Hans',
  'KR': 'ko',
  'TW': 'zh-Hant-TW',
  'HK': 'zh-Hant-HK',
  'MO': 'zh-Hant-MO',
  'TH': 'th',
  'VN': 'vi',
  'FR': 'fr',
  'DE': 'de',
  'IT': 'it',
  'ES': 'es',
  'MX': 'es-MX',
  'AR': 'es-AR',
  'CL': 'es-CL',
  'CO': 'es-CO',
  'PE': 'es-PE',
  'VE': 'es-VE',
  'EC': 'es-EC',
  'BO': 'es-BO',
  'PY': 'es-PY',
  'UY': 'es-UY',
  'RU': 'ru',
  'SA': 'ar-SA',
  'AE': 'ar-AE',
  'EG': 'ar-EG',
  'MA': 'ar-MA',
  'DZ': 'ar-DZ',
  'TN': 'ar-TN',
  'IQ': 'ar-IQ',
  'JO': 'ar-JO',
  'KW': 'ar-KW',
  'LB': 'ar-LB',
  'LY': 'ar-LY',
  'OM': 'ar-OM',
  'PS': 'ar-PS',
  'QA': 'ar-QA',
  'SD': 'ar-SD',
  'SY': 'ar-SY',
  'YE': 'ar-YE',
  'BH': 'ar-BH',
  'MR': 'ar-MR',
  'SO': 'ar-SO',
  'DJ': 'ar-DJ',
  'KM': 'ar-KM',
  'GQ': 'es-GQ',
  'IL': 'he',
  'GR': 'el',
  'CY': 'el',
  'RO': 'ro',
  'BG': 'bg',
  'RS': 'sr',
  'HR': 'hr',
  'BA': 'bs',
  'AL': 'sq',
  'MK': 'mk',
  'ME': 'sr',
  'PL': 'pl',
  'CZ': 'cs',
  'HU': 'hu',
  'SK': 'sk',
  'SI': 'sl',
  'EE': 'et',
  'LV': 'lv',
  'LT': 'lt',
  'UA': 'uk',
  'BY': 'be',
  'MD': 'ro',
  'GE': 'ka',
  'AM': 'hy',
  'TR': 'tr',
  'BT': 'dz',
  'AF': 'ps',
  'KZ': 'kk',
  'UZ': 'uz',
  'KG': 'ky',
  'TJ': 'tg',
  'TM': 'tk',
  'NL': 'nl',
  'SE': 'sv',
  'NO': 'no',
  'DK': 'da',
  'FI': 'fi',
  'PT': 'pt-PT',
  'BR': 'pt-BR',
  'AO': 'pt-AO',
  'MZ': 'pt-MZ',
  'CV': 'pt-CV',
  'GW': 'pt-GW',
  'ST': 'pt-ST',
  'PA': 'es-PA',
  'CR': 'es-CR',
  'NI': 'es-NI',
  'HN': 'es-HN',
  'SV': 'es-SV',
  'GT': 'es-GT',
  'DO': 'es-DO',
  'PR': 'es-PR',
  'CU': 'es-CU',
  'AD': 'ca',
  'MC': 'fr',
  'SM': 'it',
  'VA': 'it',
  'LI': 'de',
  'MT': 'mt',
  'LU': 'lb',
  'SG': 'en-SG',
  'AU': 'en-AU',
  'NZ': 'en-NZ',
  'IE': 'en-IE',
  'GB': 'en-GB',
  'US': 'en',
  'CA': 'en-CA',
  'ZA': 'en-ZA',
  'IN': 'en-IN',
  'PH': 'en-PH',
  'JM': 'en-JM',
  'BS': 'en-BS',
  'BB': 'en-BB',
  'GY': 'en-GY',
  'TT': 'en-TT',
  'NG': 'en-NG',
  'GH': 'en-GH',
  'KE': 'en-KE',
  'BZ': 'en-BZ',
  'MY': 'en-MY',
  'PK': 'en-PK',
  'BD': 'en-BD',
  'LK': 'en-LK',
  'NP': 'en-NP',
  'MV': 'en-MV',
  'AG': 'en-AG',
  'KN': 'en-KN',
  'LC': 'en-LC',
  'VC': 'en-VC',
  'GD': 'en-GD',
};

const BRITISH_TERRITORIES = [
  { code: 'GB', name: 'United Kingdom (Mainland)', flag: '🇬🇧' },
  { code: 'JE', name: 'Jersey', flag: '🇯🇪' },
  { code: 'GG', name: 'Guernsey', flag: '🇬🇬' },
  { code: 'IM', name: 'Isle of Man', flag: '🇮🇲' },
  { code: 'GI', name: 'Gibraltar', flag: '🇬🇮' },
  { code: 'BM', name: 'Bermuda', flag: '🇧🇲' },
  { code: 'FK', name: 'Falkland Islands', flag: '🇫🇰' },
  { code: 'MS', name: 'Montserrat', flag: '🇲🇸' },
  { code: 'TC', name: 'Turks and Caicos Islands', flag: '🇹🇨' },
  { code: 'VG', name: 'British Virgin Islands', flag: '🇻🇬' },
  { code: 'AI', name: 'Anguilla', flag: '🇦🇮' },
  { code: 'SH', name: 'Saint Helena', flag: '🇸🇭' },
  { code: 'AC', name: 'Ascension Island', flag: '🇦🇨' },
  { code: 'TA', name: 'Tristan da Cunha', flag: '🇹🇦' },
  { code: 'GS', name: 'South Georgia', flag: '🇬🇸' },
  { code: 'PN', name: 'Pitcairn Islands', flag: '🇵🇳' },
  { code: 'IO', name: 'British Indian Ocean Territory', flag: '🇩🇬' },
  { code: 'SBA', name: 'Sovereign Base Areas', flag: '🇨🇾' },
];

const FRENCH_TERRITORIES = [
  { code: 'FR', name: 'France (Mainland)', flag: '🇫🇷' },
  { code: 'GP', name: 'Guadeloupe', flag: '🇬🇵' },
  { code: 'MQ', name: 'Martinique', flag: '🇲🇶' },
  { code: 'GF', name: 'French Guiana', flag: '🇬🇫' },
  { code: 'RE', name: 'Réunion', flag: '🇷🇪' },
  { code: 'YT', name: 'Mayotte', flag: '🇾🇹' },
  { code: 'PF', name: 'French Polynesia', flag: '🇵🇫' },
  { code: 'NC', name: 'New Caledonia', flag: '🇳🇨' },
  { code: 'WF', name: 'Wallis and Futuna', flag: '🇼🇫' },
  { code: 'MF', name: 'Saint Martin', flag: '🇲🇫' },
  { code: 'BL', name: 'Saint Barthélemy', flag: '🇧🇱' },
  { code: 'PM', name: 'Saint Pierre and Miquelon', flag: '🇵🇲' },
  { code: 'TF', name: 'French Southern Lands', flag: '🇹🇫' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'CA_QC', name: 'Quebec (Canada)', flag: '⚜️' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'CI', name: 'Ivory Coast', flag: '🇨🇮' },
  { code: 'CD', name: 'DR Congo', flag: '🇨🇩' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬' },
];

const ARABIC_TERRITORIES = [
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾' },
  { code: 'SD', name: 'Sudan', flag: '🇸🇩' },
  { code: 'PS', name: 'Palestine', flag: '🇵🇸' },
  { code: 'MR', name: 'Mauritania', flag: '🇲🇷' },
  { code: 'SO', name: 'Somalia', flag: '🇸🇴' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯' },
  { code: 'KM', name: 'Comoros', flag: '🇰🇲' },
];

const ITALIAN_TERRITORIES = [
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'CH', name: 'Switzerland (IT)', flag: '🇨🇭' },
  { code: 'SM', name: 'San Marino', flag: '🇸🇲' },
  { code: 'VA', name: 'Vatican City', flag: '🇻🇦' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹' },
];

const NORWEGIAN_TERRITORIES = [
  { code: 'NO', name: 'Norway (Mainland)', flag: '🇳🇴' },
  { code: 'SJ_SVA', name: 'Svalbard', flag: '❄️' },
  { code: 'SJ_JAN', name: 'Jan Mayen', flag: '🌋' },
];

const SPANISH_TERRITORIES = [
  { code: 'ES', name: 'Spain (Mainland)', flag: '🇪🇸' },
  { code: 'ES_BAL', name: 'Balearic Islands', flag: '🏝️' },
  { code: 'ES_CAN', name: 'Canary Islands', flag: '🌋' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' }
];

const PORTUGUESE_TERRITORIES = [
  { code: 'PT', name: 'Portugal (Mainland)', flag: '🇵🇹' },
  { code: 'PT_AZO', name: 'Azores', flag: '🐋' },
  { code: 'PT_MAD', name: 'Madeira', flag: '🍷' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿' },
  { code: 'CV', name: 'Cape Verde', flag: '🇨🇻' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼' },
  { code: 'ST', name: 'São Tomé and Príncipe', flag: '🇸🇹' },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱' },
  { code: 'MO', name: 'Macau', flag: '🇲🇴' },
];

const DUTCH_TERRITORIES = [
  { code: 'NL', name: 'Netherlands (Mainland)', flag: '🇳🇱' },
  { code: 'AW', name: 'Aruba', flag: '🇦🇼' },
  { code: 'CW', name: 'Curaçao', flag: '🇨🇼' },
  { code: 'SX', name: 'Sint Maarten', flag: '🇸🇽' },
  { code: 'BQ', name: 'Caribbean Netherlands', flag: '🇧🇶' },
];

const DANISH_TERRITORIES = [
  { code: 'DK', name: 'Denmark (Mainland)', flag: '🇩🇰' },
  { code: 'FO', name: 'Faroe Islands', flag: '🇫🇴' },
  { code: 'GL', name: 'Greenland', flag: '🇬🇱' },
];

const AUSTRALIAN_TERRITORIES = [
  { code: 'AU', name: 'Australia (Mainland)', flag: '🇦🇺' },
  { code: 'CX', name: 'Christmas Island', flag: '🇨🇽' },
  { code: 'CC', name: 'Cocos (Keeling) Islands', flag: '🇨🇨' },
  { code: 'NF', name: 'Norfolk Island', flag: '🇳🇫' },
];

const US_TERRITORIES = [
  { code: 'US', name: 'USA (Mainland)', flag: '🇺🇸' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷' },
  { code: 'VI', name: 'US Virgin Islands', flag: '🇻🇮' },
  { code: 'GU', name: 'Guam', flag: '🇬🇺' },
  { code: 'MP', name: 'Northern Mariana Islands', flag: '🇲🇵' },
  { code: 'AS', name: 'American Samoa', flag: '🇦🇸' },
];

const CHILE_TERRITORIES = [
  { code: 'CL', name: 'Chile (Mainland)', flag: '🇨🇱' },
  { code: 'CL_EA', name: 'Easter Island', flag: '🗿' },
];

const CANADIAN_TERRITORIES = [
  { code: 'CA', name: 'Canada (Mainland)', flag: '🇨🇦' },
  { code: 'CA_QC', name: 'Quebec', flag: '⚜️' },
];

const GERMAN_REGIONS = [
  { code: 'DE', name: 'Germany (Mainland)', flag: '🇩🇪' },
  { code: 'DE-BW', name: 'Baden-Württemberg', flag: '🥨' },
  { code: 'DE-BY', name: 'Bayern', flag: '🍺' },
  { code: 'DE-BE', name: 'Berlin', flag: '🐻' },
  { code: 'DE-BB', name: 'Brandenburg', flag: '🏰' },
  { code: 'DE-HB', name: 'Bremen', flag: '🚢' },
  { code: 'DE-HH', name: 'Hamburg', flag: '⚓' },
  { code: 'DE-HE', name: 'Hessen', flag: '🏙️' },
  { code: 'DE-MV', name: 'Mecklenburg-Vorpommern', flag: '🌊' },
  { code: 'DE-NI', name: 'Niedersachsen', flag: '🐎' },
  { code: 'DE-NW', name: 'Nordrhein-Westfalen', flag: '🏭' },
  { code: 'DE-RP', name: 'Rheinland-Pfalz', flag: '🍷' },
  { code: 'DE-SL', name: 'Saarland', flag: '⚒️' },
  { code: 'DE-SN', name: 'Sachsen', flag: '🏰' },
  { code: 'DE-ST', name: 'Sachsen-Anhalt', flag: '🗺️' },
  { code: 'DE-SH', name: 'Schleswig-Holstein', flag: '⛵' },
  { code: 'DE-TH', name: 'Thüringen', flag: '🌲' },
];

const CENTRAL_EUROPE_TERRITORIES = [
  { code: 'PL', name: 'Poland (Mainland)', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czechia (Mainland)', flag: '🇨🇿' },
  { code: 'HU', name: 'Hungary (Mainland)', flag: '🇭🇺' },
  { code: 'SK', name: 'Slovakia (Mainland)', flag: '🇸🇰' },
  { code: 'AT', name: 'Austria (Mainland)', flag: '🇦🇹' },
  { code: 'SI', name: 'Slovenia (Mainland)', flag: '🇸🇮' },
];

const SOUTHEAST_ASIA_TERRITORIES = [
  { code: 'ID', name: 'Indonesia (Mainland)', flag: '🇮🇩' },
  { code: 'PH', name: 'Philippines (Mainland)', flag: '🇵🇭' },
  { code: 'VN', name: 'Vietnam (Mainland)', flag: '🇻🇳' },
  { code: 'TH', name: 'Thailand (Mainland)', flag: '🇹🇭' },
  { code: 'MY', name: 'Malaysia (Mainland)', flag: '🇲🇾' },
  { code: 'SG', name: 'Singapore (Mainland)', flag: '🇸🇬' },
  { code: 'KH', name: 'Cambodia (Mainland)', flag: '🇰🇭' },
  { code: 'LA', name: 'Laos (Mainland)', flag: '🇱🇦' },
  { code: 'MM', name: 'Myanmar (Mainland)', flag: '🇲🇲' },
  { code: 'BN', name: 'Brunei (Mainland)', flag: '🇧🇳' },
];

const BALKAN_TERRITORIES = [
  { code: 'GR', name: 'Greece (Mainland)', flag: '🇬🇷' },
  { code: 'CY', name: 'Cyprus (Mainland)', flag: '🇨🇾' },
  { code: 'RO', name: 'Romania (Mainland)', flag: '🇷🇴' },
  { code: 'BG', name: 'Bulgaria (Mainland)', flag: '🇧🇬' },
  { code: 'RS', name: 'Serbia (Mainland)', flag: '🇷🇸' },
  { code: 'HR', name: 'Croatia (Mainland)', flag: '🇭🇷' },
  { code: 'BA', name: 'Bosnia and Herzegovina (Mainland)', flag: '🇧🇦' },
  { code: 'AL', name: 'Albania (Mainland)', flag: '🇦🇱' },
  { code: 'MK', name: 'North Macedonia (Mainland)', flag: '🇲🇰' },
  { code: 'ME', name: 'Montenegro (Mainland)', flag: '🇲🇪' },
];

const MICROSTATES_TERRITORIES = [
  { code: 'AD', name: 'Andorra', flag: '🇦🇩' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
  { code: 'SM', name: 'San Marino', flag: '🇸🇲' },
  { code: 'VA', name: 'Vatican City', flag: '🇻🇦' },
  { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'MV', name: 'Maldives', flag: '🇲🇻' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨' },
  { code: 'MU', name: 'Mauritius', flag: '🇲🇺' },
  { code: 'BB', name: 'Barbados', flag: '🇧🇧' },
  { code: 'GD', name: 'Grenada', flag: '🇬🇩' },
  { code: 'KN', name: 'Saint Kitts and Nevis', flag: '🇰🇳' },
  { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨' },
  { code: 'VC', name: 'Saint Vincent', flag: '🇻🇨' },
  { code: 'AG', name: 'Antigua and Barbuda', flag: '🇦🇬' },
  { code: 'PW', name: 'Palau', flag: '🇵🇼' },
  { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭' },
  { code: 'NR', name: 'Nauru', flag: '🇳🇷' },
  { code: 'KI', name: 'Kiribati', flag: '🇰🇮' },
  { code: 'TV', name: 'Tuvalu', flag: '🇹🇻' },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸' },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴' },
];

const ANGLOSPHERE_TERRITORIES = [
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲' },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸' },
  { code: 'BB', name: 'Barbados', flag: '🇧🇧' },
  { code: 'TT', name: 'Trinidad & Tobago', flag: '🇹🇹' },
  { code: 'GY', name: 'Guyana', flag: '🇬🇾' },
  { code: 'BZ', name: 'Belize', flag: '🇧🇿' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
];

const HISPANOSPHERE_TERRITORIES = [
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶' },
];

const LUSOSPHERE_TERRITORIES = [
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿' },
  { code: 'CV', name: 'Cape Verde', flag: '🇨🇻' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼' },
  { code: 'ST', name: 'São Tomé and Príncipe', flag: '🇸🇹' },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱' },
  { code: 'MO', name: 'Macau', flag: '🇲🇴' },
];

const CARIBBEAN_TERRITORIES = [
  { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷' },
  { code: 'TT', name: 'Trinidad and Tobago', flag: '🇹🇹' },
  { code: 'GP', name: 'Guadeloupe', flag: '🇬🇵' },
  { code: 'MQ', name: 'Martinique', flag: '🇲🇶' },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸' },
  { code: 'BB', name: 'Barbados', flag: '🇧🇧' },
  { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨' },
  { code: 'CW', name: 'Curaçao', flag: '🇨🇼' },
  { code: 'VC', name: 'Saint Vincent', flag: '🇻🇨' },
  { code: 'GD', name: 'Grenada', flag: '🇬🇩' },
  { code: 'AG', name: 'Antigua and Barbuda', flag: '🇦🇬' },
  { code: 'DM', name: 'Dominica', flag: '🇩🇲' },
  { code: 'KN', name: 'Saint Kitts and Nevis', flag: '🇰🇳' },
  { code: 'KY', name: 'Cayman Islands', flag: '🇰🇾' },
  { code: 'VG', name: 'British Virgin Islands', flag: '🇻🇬' },
  { code: 'VI', name: 'US Virgin Islands', flag: '🇻🇮' },
  { code: 'AI', name: 'Anguilla', flag: '🇦🇮' },
  { code: 'MS', name: 'Montserrat', flag: '🇲🇸' },
  { code: 'AW', name: 'Aruba', flag: '🇦🇼' },
  { code: 'SX', name: 'Sint Maarten', flag: '🇸🇽' },
  { code: 'BL', name: 'Saint Barthélemy', flag: '🇧🇱' },
  { code: 'MF', name: 'Saint Martin', flag: '🇲🇫' },
  { code: 'BQ', name: 'Caribbean Netherlands', flag: '🇧🇶' },
  { code: 'TC', name: 'Turks and Caicos', flag: '🇹🇨' },
];

const OCEANIA_TERRITORIES = [
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬' },
  { code: 'FJ', name: 'Fiji', flag: '🇫🇯' },
  { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧' },
  { code: 'VU', name: 'Vanuatu', flag: '🇻🇺' },
  { code: 'NC', name: 'New Caledonia', flag: '🇳🇨' },
  { code: 'PF', name: 'French Polynesia', flag: '🇵🇫' },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸' },
  { code: 'GU', name: 'Guam', flag: '🇬🇺' },
  { code: 'KI', name: 'Kiribati', flag: '🇰🇮' },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴' },
  { code: 'FM', name: 'Micronesia', flag: '🇫🇲' },
  { code: 'MP', name: 'Northern Mariana Islands', flag: '🇲🇵' },
  { code: 'AS', name: 'American Samoa', flag: '🇦🇸' },
  { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭' },
  { code: 'PW', name: 'Palau', flag: '🇵🇼' },
  { code: 'CK', name: 'Cook Islands', flag: '🇨🇰' },
  { code: 'TV', name: 'Tuvalu', flag: '🇹🇻' },
  { code: 'NR', name: 'Nauru', flag: '🇳🇷' },
  { code: 'WF', name: 'Wallis and Futuna', flag: '🇼🇫' },
  { code: 'NU', name: 'Niue', flag: '🇳🇺' },
  { code: 'TK', name: 'Tokelau', flag: '🇹🇰' },
];

const GREATER_CHINA_TERRITORIES = [
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'MO', name: 'Macau', flag: '🇲🇴' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
];

const FRANCOPHONIE_TERRITORIES = [
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'CA', name: 'Canada (QC/NB)', flag: '🇨🇦' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'CI', name: 'Ivory Coast', flag: '🇨🇮' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬' },
  { code: 'CD', name: 'DR Congo', flag: '🇨🇩' },
  { code: 'CG', name: 'Congo', flag: '🇨🇬' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯' },
  { code: 'KM', name: 'Comoros', flag: '🇰🇲' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹' },
];

const NEW_ZEALAND_TERRITORIES = [
  { code: 'NZ', name: 'New Zealand (Mainland)', flag: '🇳🇿' },
  { code: 'CK', name: 'Cook Islands', flag: '🇨🇰' },
  { code: 'NU', name: 'Niue', flag: '🇳🇺' },
  { code: 'TK', name: 'Tokelau', flag: '🇹🇰' },
];

const BALTIC_TERRITORIES = [
  { code: 'EE', name: 'Estonia (Mainland)', flag: '🇪🇪' },
  { code: 'LV', name: 'Latvia (Mainland)', flag: '🇱🇻' },
  { code: 'LT', name: 'Lithuania (Mainland)', flag: '🇱🇹' },
];

const EURASIAN_TERRITORIES = [
  { code: 'TR', name: 'Turkey (Mainland)', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine (Mainland)', flag: '🇺🇦' },
  { code: 'BY', name: 'Belarus (Mainland)', flag: '🇧🇾' },
  { code: 'MD', name: 'Moldova (Mainland)', flag: '🇲🇩' },
  { code: 'GE', name: 'Georgia (Mainland)', flag: '🇬🇪' },
  { code: 'AM', name: 'Armenia (Mainland)', flag: '🇦🇲' },
  { code: 'AZ', name: 'Azerbaijan (Mainland)', flag: '🇦🇿' },
];

const NORDIC_TERRITORIES = [
  { code: 'SE', name: 'Sweden (Mainland)', flag: '🇸🇪' },
  { code: 'FI', name: 'Finland (Mainland)', flag: '🇫🇮' },
  { code: 'IS', name: 'Iceland (Mainland)', flag: '🇮🇸' },
  { code: 'NO', name: 'Norway (Mainland)', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark (Mainland)', flag: '🇩🇰' },
];

const CENTRAL_SOUTH_ASIA_TERRITORIES = [
  { code: 'KZ', name: 'Kazakhstan (Mainland)', flag: '🇰🇿' },
  { code: 'UZ', name: 'Uzbekistan (Mainland)', flag: '🇺🇿' },
  { code: 'KG', name: 'Kyrgyzstan (Mainland)', flag: '🇰🇬' },
  { code: 'TJ', name: 'Tajikistan (Mainland)', flag: '🇹🇯' },
  { code: 'TM', name: 'Turkmenistan (Mainland)', flag: '🇹🇲' },
  { code: 'AF', name: 'Afghanistan (Mainland)', flag: '🇦🇫' },
  { code: 'PK', name: 'Pakistan (Mainland)', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh (Mainland)', flag: '🇧🇩' },
  { code: 'LK', name: 'Sri Lanka (Mainland)', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal (Mainland)', flag: '🇳🇵' },
  { code: 'BT', name: 'Bhutan (Mainland)', flag: '🇧🇹' },
  { code: 'MV', name: 'Maldives (Mainland)', flag: '🇲🇻' },
];

export const AddressRegistration: React.FC<AddressRegistrationProps> = ({ 
  isOpen, 
  onClose, 
  onRegister,
  initialAgid,
  initialAddress,
  currentCoords,
  forceAoidMode
}) => {
  const [agidInput, setAgidInput] = useState(initialAgid || '');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    country: 'JP',
    recipient: '',
    organization: '',
    street: '',
    city: '',
    state: '',
    postcode: '',
    suburb: '',
    phone: '',
  });

  const [isAoidMode, setIsAoidMode] = useState(forceAoidMode || false);
  const [appLanguage, setAppLanguage] = useState<'en' | 'ja' | 'de' | 'zh-Hant' | 'zh-Hans' | 'es' | 'pt' | 'fr' | 'ar'>('en');
  const [activeTab, setActiveTab] = useState<string>('local');
  const [viewMode, setViewMode] = useState<'form' | 'language-select' | 'country-select'>('form');
  const [selectedBaseLang, setSelectedBaseLang] = useState<string | null>(null);
  const [localFormat, setLocalFormat] = useState<AddressFormat | null>(null);
  const [consensus, setConsensus] = useState<{ confidence: number, entropy: number } | null>(null);
  const [elevationData, setElevationData] = useState<{ elevation: number, source: string } | null>(null);
  const [agidData, setAgidData] = useState<any>(null);

  useEffect(() => {
    if (initialAgid) {
      const decoded = decodeAGID(initialAgid);
      setAgidData(decoded);
    }
  }, [initialAgid]);

  useEffect(() => {
    const loadFormat = async () => {
      const format = await getAddressFormat(formData.country);
      setLocalFormat(format);
    };
    loadFormat();
  }, [formData.country]);

  const t = (key: string) => {
    return UI_STRINGS[appLanguage]?.[key] || UI_STRINGS['en'][key] || key;
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAoidMode && !formData.phone) {
      setError(t('phoneRequired'));
      return;
    }
    onRegister({ ...formData, isAoid: isAoidMode });
    setSuccess(true);
    setTimeout(onClose, 1500);
  };

  const renderedAddress = useMemo(() => {
    if (!formData.country) return "";
    const canonical = createCanonicalAddress(formData);
    
    // Greater China Specialized Injection
    if (formData.country === 'CN') {
      // Mainland China: Internally store as Simplified
      const simplifiedData = { ...canonical };
      const fields = ['state', 'city', 'district', 'subdistrict', 'road', 'building'] as const;
      fields.forEach(f => {
        if (simplifiedData[f]) simplifiedData[f] = toSimplified(simplifiedData[f]);
      });
      return AddressRenderer.render(activeTab, simplifiedData);
    }
    
    if (['TW', 'HK', 'MO'].includes(formData.country)) {
      // Traditional Regions: Internally store as Traditional
      const traditionalData = { ...canonical };
      const fields = ['state', 'city', 'district', 'subdistrict', 'road', 'building'] as const;
      fields.forEach(f => {
        if (traditionalData[f]) {
          traditionalData[f] = toTraditional(traditionalData[f], formData.country as any);
        }
      });
      return AddressRenderer.render(activeTab, traditionalData);
    }
    
    return AddressRenderer.render(activeTab, canonical);
  }, [formData, activeTab]);

  const currentCountry = React.useMemo(() => {
    return COUNTRIES.find(c => c.code === formData.country);
  }, [formData.country]);

  const currentFlag = React.useMemo(() => {
    return currentCountry ? currentCountry.flag : '🌐';
  }, [currentCountry]);

  const isBritishTerritoryMode = BRITISH_TERRITORIES.some(t => t.code === formData.country);
  const isFrenchTerritoryMode = FRENCH_TERRITORIES.some(t => t.code === formData.country);
  const isNorwegianTerritoryMode = NORWEGIAN_TERRITORIES.some(t => t.code === formData.country);
  const isSpanishTerritoryMode = SPANISH_TERRITORIES.some(t => t.code === formData.country);
  const isPortugueseTerritoryMode = PORTUGUESE_TERRITORIES.some(t => t.code === formData.country);
  const isSEAterritoryMode = SOUTHEAST_ASIA_TERRITORIES.some(t => t.code === formData.country);
  const isCETerritoryMode = CENTRAL_EUROPE_TERRITORIES.some(t => t.code === formData.country);
  const isBalkanTerritoryMode = BALKAN_TERRITORIES.some(t => t.code === formData.country);
  const isBalticTerritoryMode = BALTIC_TERRITORIES.some(t => t.code === formData.country);
  const isEurasianTerritoryMode = EURASIAN_TERRITORIES.some(t => t.code === formData.country);
  const isNordicTerritoryMode = NORDIC_TERRITORIES.some(t => t.code === formData.country);
  const isCSAsianTerritoryMode = CENTRAL_SOUTH_ASIA_TERRITORIES.some(t => t.code === formData.country);
  const isDutchTerritoryMode = DUTCH_TERRITORIES.some(t => t.code === formData.country);
  const isDanishTerritoryMode = DANISH_TERRITORIES.some(t => t.code === formData.country);
  const isAustralianTerritoryMode = AUSTRALIAN_TERRITORIES.some(t => t.code === formData.country);
  const isNewZealandTerritoryMode = NEW_ZEALAND_TERRITORIES.some(t => t.code === formData.country);
  const isUSTerritoryMode = US_TERRITORIES.some(t => t.code === formData.country);
  const isArabicTerritoryMode = ARABIC_TERRITORIES.some(t => t.code === formData.country);
  const isItalianTerritoryMode = ITALIAN_TERRITORIES.some(t => t.code === formData.country);
  const isChileTerritoryMode = CHILE_TERRITORIES.some(t => t.code === formData.country);
  const isMicrostateMode = MICROSTATES_TERRITORIES.some(t => t.code === formData.country);
  const isAnglosphereMode = ANGLOSPHERE_TERRITORIES.some(t => t.code === formData.country);
  const isCanadianTerritoryMode = CANADIAN_TERRITORIES.some(t => t.code === formData.country);
  const isNZTerritoryMode = NEW_ZEALAND_TERRITORIES.some(t => t.code === formData.country);
  const isGermanRegionMode = GERMAN_REGIONS.some(t => t.code === formData.country);
  const isHispanosphereMode = HISPANOSPHERE_TERRITORIES.some(t => t.code === formData.country);
  const isLusosphereMode = LUSOSPHERE_TERRITORIES.some(t => t.code === formData.country);
  const isCaribbeanMode = CARIBBEAN_TERRITORIES.some(t => t.code === formData.country);
  const isOceaniaMode = OCEANIA_TERRITORIES.some(t => t.code === formData.country);
  const isGreaterChinaMode = GREATER_CHINA_TERRITORIES.some(t => t.code === formData.country);
  const isFrancophonieMode = FRANCOPHONIE_TERRITORIES.some(t => t.code === formData.country);

  // Address Smart Fix Logic
  const smartFixes = useMemo(() => {
    const fixes: { label: string, action: () => void, icon: any, type: 'warning' | 'info' }[] = [];

    // 1. Chinese Script Fix
    if (isGreaterChinaMode) {
      const allText = Object.values(formData).join('');
      const script = detectChineseScript(allText);
      const isMainland = formData.country === 'CN';
      
      if (isMainland && (script === 'traditional' || script === 'mixed')) {
        fixes.push({
          label: 'Convert to Simplified Chinese (Mainland Standard)',
          icon: Wand2,
          type: 'warning',
          action: () => {
            const newFields = { ...formData };
            Object.keys(newFields).forEach(k => {
              const key = k as keyof typeof formData;
              if (typeof newFields[key] === 'string' && key !== 'country' && key !== 'phone') {
                newFields[key] = toSimplified(newFields[key] as string) as any;
              }
            });
            setFormData(newFields);
          }
        });
      } else if (!isMainland && (script === 'simplified' || script === 'mixed')) {
        fixes.push({
          label: `Convert to Traditional Chinese (${formData.country} Standard)`,
          icon: Wand2,
          type: 'warning',
          action: () => {
            const newFields = { ...formData };
            Object.keys(newFields).forEach(k => {
              const key = k as keyof typeof formData;
              if (typeof newFields[key] === 'string' && key !== 'country' && key !== 'phone') {
                newFields[key] = toTraditional(newFields[key] as string, formData.country as any) as any;
              }
            });
            setFormData(newFields);
          }
        });
      }
    }

    // 2. Colombia Numbering Fix
    const houseNum = (formData as any).houseNumber || (formData as any).house_number;
    if (formData.country === 'CO' && houseNum && !houseNum.includes('#') && /^\d/.test(houseNum)) {
      fixes.push({
        label: 'Add "#" prefix to house number (Colombia standard)',
        icon: Hash,
        type: 'info',
        action: () => {
          const key = (formData as any).houseNumber ? 'houseNumber' : 'house_number';
          setFormData(prev => ({ ...prev, [key]: `# ${houseNum}` }));
        }
      });
    }

    // 3. Unicode Normalization Fix (Fullwidth characters)
    const hasFullwidth = /[Ａ-Ｚａ-ｚ０-９]/.test(Object.values(formData).join(''));
    if (hasFullwidth) {
      fixes.push({
        label: 'Normalize full-width alphanumeric characters',
        icon: ListFilter,
        type: 'info',
        action: () => {
          const newFields = { ...formData };
          Object.keys(newFields).forEach(k => {
            const key = k as keyof typeof formData;
            if (typeof newFields[key] === 'string') {
              newFields[key] = normalizeAddressText(newFields[key] as string) as any;
            }
          });
          setFormData(newFields);
        }
      });
    }

    return fixes;
  }, [formData, isGreaterChinaMode]);

  const isAnyRegionMode = useMemo(() => {
    return isBritishTerritoryMode || isFrenchTerritoryMode || isNorwegianTerritoryMode || 
           isSpanishTerritoryMode || isPortugueseTerritoryMode || isSEAterritoryMode || 
           isCETerritoryMode || isBalkanTerritoryMode || isBalticTerritoryMode || 
           isEurasianTerritoryMode || isNordicTerritoryMode || isCSAsianTerritoryMode || 
           isDutchTerritoryMode || isDanishTerritoryMode || isAustralianTerritoryMode || 
           isNewZealandTerritoryMode || isUSTerritoryMode || isArabicTerritoryMode || 
           isItalianTerritoryMode || isChileTerritoryMode || isMicrostateMode || 
           isAnglosphereMode || isCanadianTerritoryMode || isNZTerritoryMode || 
           isGermanRegionMode || isHispanosphereMode || isLusosphereMode || 
           isCaribbeanMode || isOceaniaMode || isGreaterChinaMode || isFrancophonieMode;
  }, [
    isBritishTerritoryMode, isFrenchTerritoryMode, isNorwegianTerritoryMode,
    isSpanishTerritoryMode, isPortugueseTerritoryMode, isSEAterritoryMode,
    isCETerritoryMode, isBalkanTerritoryMode, isBalticTerritoryMode,
    isEurasianTerritoryMode, isNordicTerritoryMode, isCSAsianTerritoryMode,
    isDutchTerritoryMode, isDanishTerritoryMode, isAustralianTerritoryMode,
    isNewZealandTerritoryMode, isUSTerritoryMode, isArabicTerritoryMode,
    isItalianTerritoryMode, isChileTerritoryMode, isMicrostateMode,
    isAnglosphereMode, isCanadianTerritoryMode, isNZTerritoryMode,
    isGermanRegionMode, isHispanosphereMode, isLusosphereMode,
    isCaribbeanMode, isOceaniaMode, isGreaterChinaMode, isFrancophonieMode
  ]);

  const quickLangs = useMemo(() => {
    return ['local', 'en', 'romaji', 'international'];
  }, []);

  // Group languages for selection - simplified to base languages only
  const groupedLanguages = useMemo(() => {
    const groups: Record<string, typeof LANGUAGES> = {};
    const INDIAN_LANGS = ['hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur'];
    
    LANGUAGES.forEach(lang => {
      let base = lang.code.split('-')[0];
      if (lang.code.startsWith('zh-Hans')) base = 'zh-Hans';
      if (lang.code.startsWith('zh-Hant') || lang.code === 'yue') base = 'zh-Hant';
      if (INDIAN_LANGS.includes(lang.code) || INDIAN_LANGS.includes(base)) base = 'in-regional';
      
      if (!groups[base]) groups[base] = [];
      groups[base].push(lang);
    });
    return groups;
  }, []);

  const baseLanguages = useMemo(() => {
    return Object.keys(groupedLanguages).map(base => {
      const group = groupedLanguages[base];
      
      let name, flag;
      if (base === 'in-regional') {
        name = t('tab_indian_langs');
        flag = '🇮🇳';
      } else if (base === 'zh-Hans') {
        name = t('tab_zh_hans');
        flag = '🇨🇳';
      } else if (base === 'zh-Hant') {
        name = t('tab_zh_hant');
        flag = '🇭🇰';
      } else if (base === 'en') {
        name = t('tab_anglosphere');
        flag = '🌐';
      } else if (base === 'es') {
        name = t('tab_latam_es');
        flag = '🇪🇸';
      } else if (base === 'pt') {
        name = t('tab_lusosphere');
        flag = '🇵🇹';
      } else if (base === 'ar') {
        name = t('tab_arabic_global');
        flag = '☪️';
      } else if (base === 'fr') {
        name = 'Français';
        flag = '🇫🇷';
      } else {
        const main = group.find(l => !l.code.includes('-')) || group[0];
        name = LANGUAGE_NAMES[base] || main.name.split(' (')[0];
        flag = main.flag;
      }
      
      return {
        base,
        name,
        flag,
        count: group.length,
        variants: group
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [groupedLanguages, appLanguage]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl z-[101] border border-slate-200"
          >
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 rounded-2xl">
                    <MapPin className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                      {t('addressRegistration')}
                    </h2>
                    {/* App Language Toggle */}
                    <div className="flex flex-wrap bg-slate-100 rounded-lg p-0.5 mt-1 w-fit gap-0.5">
                      {(['en', 'ja', 'de', 'zh-Hant', 'zh-Hans', 'es', 'pt', 'fr', 'ar'] as const).map(lang => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setAppLanguage(lang)}
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[8px] font-black transition-all",
                            appLanguage === lang ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          {lang === 'zh-Hant' ? '繁中' : lang === 'zh-Hans' ? '简中' : lang.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {viewMode === 'form' ? (
                  <motion.form 
                    key="form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onSubmit={handleRegister} 
                    className="space-y-8"
                  >
                {/* AOID Mode Toggle */}
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 font-black text-[10px] uppercase tracking-widest">
                      <ShieldIcon className="w-3 h-3" />
                      {t('registerAoid')}
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsAoidMode(!isAoidMode)}
                      className={cn(
                        "relative w-14 h-7 rounded-3xl transition-colors",
                        isAoidMode ? "bg-emerald-500" : "bg-slate-300"
                      )}
                    >
                      <motion.div 
                        animate={{ x: isAoidMode ? 29 : 3 }}
                        className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-600/80 font-bold leading-relaxed">
                    {t('aoidTip')}
                  </p>
                </div>

                    <div className="space-y-6">
                      {/* Address Rendering Preview (Carrier Label Style) */}
                      <div className="bg-slate-900 rounded-xl p-6 text-white shadow-inner overflow-hidden relative group">
                        <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <QrCode className="w-12 h-12" />
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className={cn(
                            "w-2 h-2 rounded-full animate-pulse",
                            renderedAddress ? "bg-emerald-500" : "bg-slate-500"
                          )} />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            {activeTab === 'en' || activeTab === 'international' ? 'International Shipping Label' : 'Domestic Delivery Format'}
                          </span>
                        </div>
                        <div className="relative">
                          <pre className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed min-h-[4em] selection:bg-emerald-500/30">
                            {renderedAddress || 'Waiting for input...'}
                          </pre>
                        </div>
                        
                        {/* Regional Logic Tag */}
                        {['CN', 'TW', 'HK', 'MO'].includes(formData.country) && (
                          <div className="mt-4 flex items-center gap-2">
                             <div className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-tight">
                               Modular Chinese Engine Active
                             </div>
                             {formData.country === 'CN' && activeTab !== 'en' && activeTab !== 'international' && (
                               <div className="text-[9px] font-black bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 uppercase tracking-tight">
                                 Simplified Canonical
                               </div>
                             )}
                             {['TW', 'HK', 'MO'].includes(formData.country) && !activeTab.startsWith('en') && activeTab !== 'international' && activeTab !== 'romaji' && (
                               <div className="text-[9px] font-black bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 uppercase tracking-tight">
                                 Traditional Canonical
                               </div>
                             )}
                          </div>
                        )}
                      </div>

                        {/* Smart Fix Notification */}
                        <AnimatePresence>
                          {smartFixes.length > 0 && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-4 space-y-2"
                            >
                              {smartFixes.map((fix, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={fix.action}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                                    fix.type === 'warning' 
                                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                  )}
                                >
                                  <fix.icon className="w-4 h-4 shrink-0" />
                                  <span className="text-[11px] font-black tracking-tight">{fix.label}</span>
                                  <div className="ml-auto bg-white/10 px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-black">
                                    Apply Fix
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                      {/* Language Selection */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Address Language
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          {quickLangs.map(lang => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => setActiveTab(lang)}
                              className={cn(
                                "px-4 py-2 rounded-xl text-xs font-black transition-all border",
                                activeTab === lang 
                                  ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                                  : "bg-slate-100 text-slate-500 border-slate-100 hover:text-slate-700"
                              )}
                            >
                              {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setViewMode('language-select')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-black transition-all border flex items-center gap-2",
                              !['local', 'en', 'romaji', 'international'].includes(activeTab)
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                            )}
                          >
                            <Globe className="w-3 h-3" />
                            {!['local', 'en', 'romaji', 'international'].includes(activeTab) 
                              ? (LANGUAGE_NAMES[activeTab] || activeTab.toUpperCase())
                              : 'Other...'}
                            <ChevronRight className="w-3 h-3 rotate-90" />
                          </button>
                        </div>
                      </div>

                      {/* Country Selector */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {t('countryRegion')}
                          </label>
                          <button
                            type="button"
                            onClick={() => setViewMode('country-select')}
                            className="w-full bg-slate-50 px-4 py-4 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-white transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl rounded-xl shadow-sm">{currentFlag}</span>
                              <span className="text-sm font-black text-slate-700">{currentCountry?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Territory indicator */}
                              {isAnyRegionMode && (
                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Regions</span>
                              )}
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Ordered Fields */}
                  <div className="space-y-6">
                    {localFormat ? (
                      (() => {
                        let currentFormat = localFormat.native;
                        if (activeTab === 'en' && localFormat.english) {
                          currentFormat = localFormat.english;
                        } else if (localFormat.international && localFormat.international[activeTab]) {
                          currentFormat = localFormat.international[activeTab];
                        }
                        
                        const fields = currentFormat?.fields || localFormat.fields || [];
                        
                        return fields.map(field => (
                          <div key={field.key} className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              {field.key === 'postcode' && <Mail className="w-3 h-3" />}
                              {field.key === 'organization' && <Building2 className="w-3 h-3" />}
                              {field.label}
                            </label>
                            {field.key === 'street' || field.key === 'organization' ? (
                              <textarea
                                rows={field.key === 'organization' ? 2 : 3}
                                value={(formData as any)[field.key] || ''}
                                onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                                placeholder={field.placeholder}
                                className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                              />
                            ) : field.key === 'postcode' ? (
                              <PostcodeInput
                                format="7-digit"
                                value={formData.postcode}
                                onChange={(val) => setFormData({ ...formData, postcode: val })}
                                className="flex-wrap"
                                countryCode={formData.country}
                              />
                            ) : (
                              <input
                                type={field.type || 'text'}
                                value={(formData as any)[field.key] || ''}
                                onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                                placeholder={field.placeholder}
                                className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                              />
                            )}
                          </div>
                        ));
                      })()
                    ) : (
                      <div className="p-8 text-center text-slate-400">Loading format...</div>
                    )}
                  </div>

                  {/* AGID Metadata Section */}
                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                      <AgidIcon className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        AGID Algorithm Metadata
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Mountain Class</div>
                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Mountain className="w-3 h-3 text-slate-400" />
                          {elevationData?.elevation !== undefined ? `Class ${calculateMountainClass(elevationData.elevation)}` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Confidence</div>
                        <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {consensus ? `${(consensus.confidence * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Entropy</div>
                        <div className="text-xs font-mono text-slate-600">
                          {consensus ? consensus.entropy.toFixed(3) : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Domain</div>
                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          {agidData?.domain || 'Standard'}
                        </div>
                      </div>
                    </div>

                    {/* China-specific Coordinate Transformations */}
                    {formData.country === 'CN' && currentCoords && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-100/50">
                          <div className="text-[9px] text-amber-600 font-black uppercase mb-1">GCJ-02 (Amap/Tencent)</div>
                          <div className="text-[10px] font-mono font-bold text-amber-800">
                            {(() => {
                              const transformed = wgs84togcj02(currentCoords.lon, currentCoords.lat);
                              return `${transformed[1].toFixed(5)}, ${transformed[0].toFixed(5)}`;
                            })()}
                          </div>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100/50">
                          <div className="text-[9px] text-blue-600 font-black uppercase mb-1">BD-09 (Baidu Maps)</div>
                          <div className="text-[10px] font-mono font-bold text-blue-800">
                            {(() => {
                              const transformed = wgs84tobd09(currentCoords.lon, currentCoords.lat);
                              return `${transformed[1].toFixed(5)}, ${transformed[0].toFixed(5)}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                    <div className="pt-6">
                      <button 
                        type="submit"
                        className={cn(
                          "w-full py-5 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95",
                          isAoidMode 
                            ? "bg-slate-900 text-white shadow-slate-200" 
                            : "bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700"
                        )}
                      >
                        {isAoidMode ? <ShieldIcon className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                        {isAoidMode ? t('registerAsAoid') : t('registerAddress')}
                      </button>
                    </div>
                  </motion.form>
                ) : viewMode === 'language-select' ? (
                  <motion.div
                    key="language-select"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6 min-h-[500px]"
                  >
                    <div className="flex items-center gap-4 mb-8">
                      <button 
                        onClick={() => {
                          if (selectedBaseLang) setSelectedBaseLang(null);
                          else setViewMode('form');
                        }}
                        className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 rotate-180" />
                      </button>
                      <div>
                        <h3 className="text-xl font-black text-slate-800">
                          {selectedBaseLang ? 'Select Specific Language' : 'Select Language Group'}
                        </h3>
                        <p className="text-xs font-bold text-slate-400">Choose the language for this address</p>
                      </div>
                    </div>

                    {!selectedBaseLang ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {baseLanguages.map(({ base, count }) => (
                          <button
                            key={base}
                            onClick={() => setSelectedBaseLang(base)}
                            className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-emerald-200 transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-emerald-600 shadow-sm border border-slate-100">
                                {base.toUpperCase()}
                              </div>
                              <div className="text-left">
                                <div className="text-sm font-black text-slate-700">
                                  {LANGUAGE_NAMES[base] || base.toUpperCase()}
                                </div>
                                <div className="text-[10px] font-bold text-slate-400">
                                  {count} regional variations
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(groupedLanguages[selectedBaseLang] || []).map(lang => (
                            <button
                              key={lang.code}
                              onClick={() => {
                                setActiveTab(lang.code);
                                setViewMode('form');
                                setSelectedBaseLang(null);
                              }}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border transition-all group",
                                activeTab === lang.code
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-lg"
                                  : "bg-slate-50 border-slate-100 hover:bg-white hover:border-emerald-200"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border",
                                  activeTab === lang.code ? "bg-emerald-500 border-emerald-400" : "bg-white border-slate-100 text-emerald-600"
                                )}>
                                  {lang.code.split('-')[1] || lang.code.toUpperCase()}
                                </div>
                                <span className={cn(
                                  "text-xs font-black",
                                  activeTab === lang.code ? "text-white" : "text-slate-700"
                                )}>
                                  {lang.name}
                                </span>
                              </div>
                              <CheckCircle2 className={cn(
                                "w-4 h-4 transition-opacity",
                                activeTab === lang.code ? "opacity-100" : "opacity-0"
                              )} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="country-select"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6 min-h-[500px]"
                  >
                    <div className="flex items-center gap-4 mb-8">
                      <button 
                        onClick={() => setViewMode('form')}
                        className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 rotate-180" />
                      </button>
                      <div>
                        <h3 className="text-xl font-black text-slate-800">Select Country / Region</h3>
                        <p className="text-xs font-bold text-slate-400">Choose the destination for this address</p>
                      </div>
                    </div>

                    <div className="space-y-8">
                      {/* Main Countries */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Countries
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {COUNTRIES.map(c => (
                            <button
                              key={c.code}
                              onClick={() => {
                                setFormData({...formData, country: c.code});
                                setViewMode('form');
                              }}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border transition-all group",
                                formData.country === c.code
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-lg"
                                  : "bg-slate-50 border-slate-100 hover:bg-white hover:border-emerald-200"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl grayscale-0 group-hover:scale-110 transition-transform">
                                  {c.flag}
                                </span>
                                <span className={cn(
                                  "text-xs font-black",
                                  formData.country === c.code ? "text-white" : "text-slate-700"
                                )}>
                                  {c.name}
                                </span>
                              </div>
                              <CheckCircle2 className={cn(
                                "w-4 h-4 transition-opacity",
                                formData.country === c.code ? "opacity-100" : "opacity-0"
                              )} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Regional Territories */}
                      <div className="space-y-6">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Regional & Overseas Territories
                        </label>
                        
                        {[
                          { title: 'Anglosphere', items: ANGLOSPHERE_TERRITORIES, color: 'blue' },
                          { title: 'Hispanosphere', items: HISPANOSPHERE_TERRITORIES, color: 'yellow' },
                          { title: 'Lusosphere', items: LUSOSPHERE_TERRITORIES, color: 'red' },
                          { title: 'Greater China', items: GREATER_CHINA_TERRITORIES, color: 'red' },
                          { title: 'Francophonie', items: FRANCOPHONIE_TERRITORIES, color: 'blue' },
                          { title: 'Arabic World', items: ARABIC_TERRITORIES, color: 'emerald' },
                          { title: 'Southeast Asia', items: SOUTHEAST_ASIA_TERRITORIES, color: 'emerald' },
                          { title: 'Oceania & Pacific', items: OCEANIA_TERRITORIES, color: 'sky' },
                          { title: 'Caribbean', items: CARIBBEAN_TERRITORIES, color: 'amber' },
                          { title: 'European Union', items: CENTRAL_EUROPE_TERRITORIES, color: 'indigo' },
                          { title: 'Nordic & Baltic', items: [...NORDIC_TERRITORIES, ...BALTIC_TERRITORIES, ...NORWEGIAN_TERRITORIES], color: 'slate' },
                          { title: 'Balkans', items: BALKAN_TERRITORIES, color: 'blue' },
                          { title: 'Central Eurasia', items: [...EURASIAN_TERRITORIES, ...CENTRAL_SOUTH_ASIA_TERRITORIES], color: 'rose' },
                          { title: 'Italian Regions', items: ITALIAN_TERRITORIES, color: 'green' },
                          { title: 'German Regions', items: GERMAN_REGIONS, color: 'emerald' },
                          { title: 'British Regions', items: BRITISH_TERRITORIES, color: 'emerald' },
                          { title: 'French Regions', items: FRENCH_TERRITORIES, color: 'blue' },
                          { title: 'Microstates', items: MICROSTATES_TERRITORIES, color: 'amber' },
                        ].map(group => (
                          <div key={group.title} className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-500 flex items-center gap-2">
                              {group.title}
                              <span className="h-[1px] flex-1 bg-slate-100"></span>
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {group.items.map(t => (
                                <button
                                  key={t.code}
                                  onClick={() => {
                                    const isMainland = t.name.includes('(Mainland)');
                                    setFormData({
                                      ...formData, 
                                      country: t.code,
                                      state: isMainland ? '' : t.name
                                    });
                                    setViewMode('form');
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-3 rounded-xl text-[10px] font-bold transition-all border",
                                    formData.country === t.code
                                      ? `bg-${group.color}-600 text-white border-${group.color}-600 shadow-sm`
                                      : "bg-white text-slate-600 hover:bg-slate-50 border-slate-100"
                                  )}
                                >
                                  <span className="text-sm">{t.flag}</span>
                                  <span className="truncate">{t.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
