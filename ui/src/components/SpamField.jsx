
export default function SpamField(props) {
  const handleChange = () => {
    // gotcha
    window.location.href = "about:blank";
  };

  const hideStyle = {display: "none"};

  const getRandomInt = (n) => Math.floor(Math.random() * n);
  const number = getRandomInt(100)
  const name="input-" + number

  return <>
    <label htmlFor={name} style={hideStyle}>Pipeline input {number}</label>
    <input type="text" name={name} id={name} onChange={handleChange} style={hideStyle}></input>
  </>;

}
