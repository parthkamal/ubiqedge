import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Alert from '@cloudscape-design/components/alert';
import { useAuth } from '../hooks/useAuth';
import logo from '../assets/ubiqedge-logo-large.png';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box padding={{ vertical: 'xxxl' }}>
      <Box textAlign="center" margin={{ bottom: 'l' }}>
        <img src={logo} alt="UbiqEdge" height={60} />
        <Box color="text-body-secondary" margin={{ top: 'xs' }}>
          Water billing portal
        </Box>
      </Box>
      <Box display="flex" float="none" textAlign="center">
        <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left' }}>
          <Container header={<Header variant="h2">Sign in</Header>}>
            <form onSubmit={handleSubmit}>
              <Form
                errorText={error}
                actions={
                  <Button variant="primary" loading={submitting} formAction="submit">
                    Sign in
                  </Button>
                }
              >
                <SpaceBetween size="l">
                  {error && <Alert type="error">{error}</Alert>}
                  <FormField label="Email">
                    <Input
                      type="email"
                      value={email}
                      onChange={({ detail }) => setEmail(detail.value)}
                      autoFocus
                    />
                  </FormField>
                  <FormField label="Password">
                    <Input
                      type="password"
                      value={password}
                      onChange={({ detail }) => setPassword(detail.value)}
                    />
                  </FormField>
                </SpaceBetween>
              </Form>
            </form>
          </Container>
        </div>
      </Box>
    </Box>
  );
}
