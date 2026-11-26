import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';

export function LifecycleMessage({ status, message, style }) {
  return <Alert style={style} severity={status == 'deprecated' ? "warning" : "info"}>
    {message}
  </Alert>
}

export function LifecycleChip({ lifecycle }) {

  const { t } = useTranslation();
  let status = lifecycle?.status || "in_development";

  let chipStyle = {
                    marginBottom: '8px',
                    backgroundColor: '#76d2ff',
                    color: 'black',
                    marginRight: '6px'
                  };
  switch (status) {
    case 'in_development':
      chipStyle.backgroundColor = '#76d2ff';
      break;
    case 'in_review':
      chipStyle.backgroundColor = '#fdd58c';
      break;
    case 'reviewed':
      chipStyle.backgroundColor = '#60dfc0';
      break;
    case 'core':
      chipStyle.backgroundColor = '#999';
      break;
    case 'deprecated':
      chipStyle.backgroundColor = 'black';
      chipStyle.color = 'white';
      break;
    case 'example':
      chipStyle.backgroundColor = '#c7a9ff';
      break;
    case 'subpipeline':
      chipStyle.backgroundColor = '#ffa9c6';
      break;
    case 'stale':
      chipStyle.backgroundColor = '#5d5d5d';
      chipStyle.color = 'white';
      break;
    case 'none': // used when script not found on server
      return null;
    default:
      console.warn(`Unknown lifecycle status: ${status}`);
  }
  const known = t(`lifecycle.${status}.label`, { defaultValue: "" });
  const displayText = known || t("lifecycle.unknown");
  const title = known ? t(`lifecycle.${status}.title`) : "";
  return <Chip label={displayText} size="small" title={title} style={chipStyle} color='primary'/>

}
