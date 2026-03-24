export type CityData = {
  name: string;
  neighborhoods: string[];
};

export const CITIES: CityData[] = [
  {
    name: "Goiânia",
    neighborhoods: [
      "Setor Bueno",
      "Setor Sul",
      "Setor Oeste",
      "Setor Central",
      "Setor Marista",
      "Setor Nova Suíça",
      "Setor Pedro Ludovico",
      "Setor Aeroporto",
      "Setor Alto da Glória",
      "Setor Campinas",
      "Jardim Goiás",
      "Jardim América",
      "Jardim Atlântico",
      "Jardim Europa",
      "Jardim Presidente",
      "Parque Amazônia",
      "Parque Anhanguera",
      "Residencial Eldorado",
      "Vila Brasília",
      "Chácara do Governador",
      "Leste Universitário",
      "Cidade Jardim",
      "Mansões Paraíso",
      "Setor dos Funcionários",
      "Novo Horizonte",
    ],
  },
  {
    name: "Aparecida de Goiânia",
    neighborhoods: [
      "Setor Garavelo",
      "Vila Brasília",
      "Jardim Tiradentes",
      "Cidade Livre",
      "Bairro dos Americanos",
      "Setor Central",
      "Parque Industrial",
      "Jardim Olímpico",
      "Residencial do Lago",
      "Vila São Tomás",
    ],
  },
  {
    name: "Senador Canedo",
    neighborhoods: [
      "Setor Central",
      "Residencial Alvorada",
      "Jardim Canedo",
      "Parque Bela Vista",
      "Vila Nova",
      "Setor Jardim Das Flores",
    ],
  },
  {
    name: "Trindade",
    neighborhoods: [
      "Setor Central",
      "Jardim Primavera",
      "Residencial dos Lagos",
      "Vila Santa Maria",
    ],
  },
  {
    name: "Goianira",
    neighborhoods: [
      "Setor Central",
      "Jardim Santa Marta",
      "Residencial Solar",
    ],
  },
];

export const ALL_CITY_NAMES = CITIES.map((c) => c.name);

export function getNeighborhoods(cityName: string): string[] {
  return CITIES.find((c) => c.name === cityName)?.neighborhoods ?? [];
}
