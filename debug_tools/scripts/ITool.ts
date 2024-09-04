export enum IToolConfigurationExperience {
  noData = 0,
  dataAsString = 1,
  dataAsLocation = 2,
}

export default interface ITool {
  id: string;
  data: string;
  typeId: string;
  configurationExperience: IToolConfigurationExperience;
  getConfigurationDataPropertyTitle?: () => string;
  run: () => void;
}
