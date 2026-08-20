import { buildCreateUserForm, parseTokenList, parseUserList } from '../adminWeb';
import {
  decodeEntities,
  extractCsrfToken,
  looksLikeLoginPage,
  parseFormError,
} from '../webForm';

/**
 * Fixture mirroring Baby Buddy's `user_list.html`: username in a
 * `<th scope="row">`, pk only inside the row's edit/delete action links, status
 * columns rendered as icons (`bool_icon`). Two users, one staff.
 */
const USER_LIST_HTML = `
<table class="table">
  <thead>
    <tr><th>Username</th><th>First</th><th>Last</th><th>Email</th>
        <th>Read only</th><th>Staff</th><th>Active</th><th>Locked</th><th></th></tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">admin</th>
      <td>Ada</td><td>Min</td><td>admin@example.com</td>
      <td class="text-center"><svg class="icon-false"></svg></td>
      <td class="text-center"><svg class="icon-true"></svg></td>
      <td class="text-center"><svg class="icon-true"></svg></td>
      <td class="text-center"><svg class="icon-false"></svg></td>
      <td class="text-center">
        <a href="/users/1/edit/">Edit</a>
        <a href="/users/1/delete/">Delete</a>
      </td>
    </tr>
    <tr>
      <th scope="row">grandma &amp; co</th>
      <td>Grand</td><td>Ma</td><td>gma@example.com</td>
      <td class="text-center"><svg class="icon-false"></svg></td>
      <td class="text-center"><svg class="icon-false"></svg></td>
      <td class="text-center"><svg class="icon-true"></svg></td>
      <td class="text-center"><svg class="icon-false"></svg></td>
      <td class="text-center">
        <a href="/users/42/edit/">Edit</a>
        <a href="/users/42/delete/">Delete</a>
      </td>
    </tr>
  </tbody>
</table>
`;

describe('parseUserList', () => {
  it('extracts id + username for each row', () => {
    expect(parseUserList(USER_LIST_HTML)).toEqual([
      { id: 1, username: 'admin' },
      { id: 42, username: 'grandma & co' },
    ]);
  });

  it('decodes HTML entities in usernames', () => {
    const [, gma] = parseUserList(USER_LIST_HTML);
    expect(gma.username).toBe('grandma & co');
  });

  it('skips rows without both a username cell and a pk link', () => {
    const html = `
      <tr><th scope="row">headeronly</th><td>no links</td></tr>
      <tr><td>no username</td><td><a href="/users/9/edit/">Edit</a></td></tr>
    `;
    expect(parseUserList(html)).toEqual([]);
  });

  it('returns an empty list for an empty table', () => {
    expect(parseUserList('<table><tbody></tbody></table>')).toEqual([]);
  });
});

describe('buildCreateUserForm', () => {
  it('builds a non-admin, read+write user body (is_staff/is_read_only omitted)', () => {
    const body = buildCreateUserForm('csrf-123', {
      username: 'newcaregiver',
      password: 's3cret-pass',
      firstName: 'New',
    });
    expect(body).toEqual({
      csrfmiddlewaretoken: 'csrf-123',
      username: 'newcaregiver',
      first_name: 'New',
      last_name: '',
      email: '',
      password1: 's3cret-pass',
      password2: 's3cret-pass',
      is_active: 'on',
    });
    expect(body).not.toHaveProperty('is_staff');
    expect(body).not.toHaveProperty('is_read_only');
  });

  it('sends both password fields identical (UserCreationForm confirmation)', () => {
    const body = buildCreateUserForm('c', { username: 'u', password: 'pw' });
    expect(body.password1).toBe(body.password2);
    expect(body.password1).toBe('pw');
  });

  it('defaults first_name/last_name to empty when omitted', () => {
    const body = buildCreateUserForm('c', { username: 'u', password: 'pw' });
    expect(body.first_name).toBe('');
    expect(body.last_name).toBe('');
  });

  it('includes first/last name and is_staff when requested', () => {
    const body = buildCreateUserForm('c', {
      username: 'u',
      password: 'pw',
      firstName: 'Grand',
      lastName: 'Ma',
      isStaff: true,
    });
    expect(body.first_name).toBe('Grand');
    expect(body.last_name).toBe('Ma');
    expect(body.is_staff).toBe('on');
  });

  it('omits is_staff when isStaff is false', () => {
    const body = buildCreateUserForm('c', { username: 'u', password: 'pw', isStaff: false });
    expect(body).not.toHaveProperty('is_staff');
  });
});

describe('parseTokenList', () => {
  const TOKEN_HTML = `
    <table id="result_list">
      <tbody>
        <tr class="row1">
          <th class="field-key"><a href="/admin/authtoken/tokenproxy/1/change/">43f949fa811d0eca1552510b38de6f60c802de77</a></th>
          <td class="field-user">moshe</td>
          <td class="field-created">Aug. 20, 2026</td>
        </tr>
        <tr class="row2">
          <th class="field-key"><a href="/admin/authtoken/tokenproxy/2/change/">0000111122223333444455556666777788889999</a></th>
          <td class="field-user">grandma &amp; co</td>
          <td class="field-created">Aug. 21, 2026</td>
        </tr>
      </tbody>
    </table>`;

  it('maps each row to { username, token }', () => {
    expect(parseTokenList(TOKEN_HTML)).toEqual([
      { username: 'moshe', token: '43f949fa811d0eca1552510b38de6f60c802de77' },
      { username: 'grandma & co', token: '0000111122223333444455556666777788889999' },
    ]);
  });

  it('skips rows missing a 40-hex key or a user cell', () => {
    const html = `
      <tr><th class="field-key"><a>notatoken</a></th><td class="field-user">x</td></tr>
      <tr><th class="field-key"><a>43f949fa811d0eca1552510b38de6f60c802de77</a></th></tr>`;
    expect(parseTokenList(html)).toEqual([]);
  });

  it('returns empty for a page with no result rows', () => {
    expect(parseTokenList('<p>0 tokens</p>')).toEqual([]);
  });
});

describe('extractCsrfToken', () => {
  it('reads the hidden csrf input value', () => {
    const html = `<input type="hidden" name="csrfmiddlewaretoken" value="tok-abc">`;
    expect(extractCsrfToken(html)).toBe('tok-abc');
  });

  it('returns null when absent', () => {
    expect(extractCsrfToken('<form></form>')).toBeNull();
  });
});

describe('looksLikeLoginPage', () => {
  it('is true for a page with username + password inputs', () => {
    const html = `<input name="username"><input name="password" type="password">`;
    expect(looksLikeLoginPage(html)).toBe(true);
  });

  it('is false for the user list', () => {
    expect(looksLikeLoginPage(USER_LIST_HTML)).toBe(false);
  });
});

describe('parseFormError', () => {
  it('recovers the first Django form error message', () => {
    const html = `
      <form>
        <ul class="errorlist"><li>A user with that username already exists.</li></ul>
      </form>`;
    expect(parseFormError(html)).toBe('A user with that username already exists.');
  });

  it('returns null when there is no errorlist', () => {
    expect(parseFormError('<form>all good</form>')).toBeNull();
  });
});

describe('decodeEntities', () => {
  it('decodes the common named + numeric entities', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;')).toBe(
      `a & b <c> "d" 'e'`,
    );
  });
});
