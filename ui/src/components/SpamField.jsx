
export default function SpamField(props) {
  const handleChange = () => {
    // do captcha
    window.location.href = "about:blank";
  };

  const hideStyle = {display: "block"};

  const getRandomInt = (n) => Math.floor(Math.random() * n);

  return (<><label for="input" style={hideStyle}>pipeline input {getRandomInt(100)}</label>
      <input type="text" name="input" id={"input-"+getRandomInt(100)} onChange={handleChange} style={hideStyle}></input></>);

}
